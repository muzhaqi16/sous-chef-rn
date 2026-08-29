/**
 * Integration test: optimistic mutation flips the Apollo cache immediately,
 * then converges on the server response.
 *
 * Boundary under test: `useToggleShoppingItem` (a mutation hook) plus the
 * Apollo `InMemoryCache` plus the cache-updater utilities the hook calls.
 * The contract is:
 *   - calling `toggleItem` updates the cached purchase status synchronously
 *     via `optimisticResponse` + `update` (visible to the next cache read
 *     before the network request resolves);
 *   - when the server confirms the optimistic value, the cache stays in the
 *     same state after settle.
 *
 * Real implementations on both sides:
 *  - the hook itself, with no mocks of `useMutation` or `useApolloClient`.
 *    It runs through the production `optimisticResponse` builder and
 *    `update` callback (which calls the real cache modify + connection
 *    move helpers).
 *  - the Apollo cache, configured the same way the production cache is.
 *    We use `InMemoryCache` directly because `makeCache()` drags in the
 *    fragment matcher and other production-only wiring that's irrelevant
 *    to this seam; `__typename` keying is enough for the cache fragment
 *    reads the SUT performs.
 *
 * Mocks live only at the I/O boundary: `MockLink` for network responses,
 * plus the peripheral utilities the SUT calls (error handlers,
 * network-error detector, optimistic-data persistence). These are
 * unrelated to the cache seam under test.
 */

'use no memo';

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import type { ReactNode } from 'react';
import React from 'react';
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { MockLink } from '@apollo/client/testing';
import type { Unmasked } from '@apollo/client/masking';
import {
  ToggleShoppingListItemPurchasedDocument,
  type ToggleShoppingListItemPurchasedMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { useToggleShoppingItem } from '#features/shoppingList/hooks/mutations/useToggleShoppingItem';

// Peripheral mocks — dependencies of the SUT that have nothing to do with
// the cache seam under test. Stubbing them keeps the assertion focused on
// the optimistic + cache-update behavior.
jest.mock('#/utils/errorHandlers', () => ({
  handleMutationError: jest.fn(),
}));
jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));

const LIST_ID = 'list-1';
const ITEM_ID = 'item-1';

function seedItem(cache: InMemoryCache, isPurchased: boolean) {
  const data: ShoppingListItemDisplayFragment = {
    __typename: 'ShoppingListItem',
    id: ITEM_ID,
    shoppingList: { __typename: 'ShoppingList', id: LIST_ID },
    itemName: 'Milk',
    quantity: 1,
    quantityInput: '1',
    displayFormat: DisplayFormat.Decimal,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased,
    },
    version: 1,
    updatedAt: '2025-01-01T00:00:00.000Z',
    category: 'Dairy',
    notes: null,
    unitName: null,
    unit: null,
    sortOrder: 'a0',
    item: null,
  };
  cache.writeFragment({
    id: cache.identify({ __typename: 'ShoppingListItem', id: ITEM_ID })!,
    fragment: ShoppingListItemDisplayFragmentDoc,
    fragmentName: 'ShoppingListItemDisplayFragment',
    data,
  });
}

function readPurchaseStatus(cache: InMemoryCache): boolean | undefined {
  const item = cache.readFragment<ShoppingListItemDisplayFragment>({
    id: cache.identify({ __typename: 'ShoppingListItem', id: ITEM_ID })!,
    fragment: ShoppingListItemDisplayFragmentDoc,
    fragmentName: 'ShoppingListItemDisplayFragment',
  });
  return item?.purchaseInfo?.isPurchased;
}

function buildSettledServerResponse(
  newPurchased: boolean,
): Unmasked<ToggleShoppingListItemPurchasedMutation> {
  return {
    __typename: 'Mutation',
    toggleShoppingListItemPurchased: {
      __typename: 'ToggleShoppingListItemPurchasedPayload',
      shoppingListItem: {
        __typename: 'ShoppingListItem',
        id: ITEM_ID,
        itemName: 'Milk',
        quantity: 1,
        quantityInput: '1',
        displayFormat: DisplayFormat.Decimal,
        // The whole object, matching the mutation's selection: a partial
        // `purchaseInfo` write REPLACES the cached one (see the type policies in
        // apollo/cache.ts), so the server response has to carry every field it
        // owns rather than just the flag that changed.
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: newPurchased,
          purchasedQuantity: newPurchased ? 1 : null,
          purchasedPrice: newPurchased ? 2.5 : null,
          purchaseDate: newPurchased ? '2026-01-01T00:00:00.000Z' : null,
          purchasedBy: newPurchased
            ? {
                __typename: 'User',
                id: 'user-1',
                profile: {
                  __typename: 'UserProfile',
                  id: 'profile-1',
                  displayName: 'Sam',
                  avatar: null,
                },
              }
            : null,
        },
        // The server creates a purchase row on each mark-purchased, so the
        // summary moves with `newPurchased`. The mutation selects it precisely
        // so this lands in the cache — otherwise ItemDetail keeps showing the
        // pre-toggle count.
        purchaseHistory: {
          __typename: 'PurchaseHistorySummary',
          previouslyPurchased: newPurchased,
          purchaseCount: newPurchased ? 1 : 0,
          lastPurchaseDate: newPurchased ? '2026-01-01T00:00:00.000Z' : null,
        },
        version: 2,
        updatedAt: '2025-01-02T00:00:00.000Z',
        category: 'Dairy',
        notes: null,
        unitName: null,
        unit: null,
        sortOrder: 'a0',
        item: null,
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          totalItems: 0,
          completedItems: 0,
          remainingItems: 0,
          completionRate: 0,
        },
      },
    },
  };
}

function buildClient(opts: {
  initialPurchased: boolean;
  serverResponse: ToggleShoppingListItemPurchasedMutation;
  serverDelayMs?: number;
}) {
  const cache = new InMemoryCache();
  seedItem(cache, opts.initialPurchased);

  const newPurchased = !opts.initialPurchased;
  const responses: MockedResponse[] = [
    {
      request: {
        query: ToggleShoppingListItemPurchasedDocument,
        // A predicate, not an exact object: the toggle mints an
        // `idempotencyKey` per call — the thing that makes an un-mark
        // replay-safe — so the payload cannot be written out literally.
        variables: vars =>
          (vars as { input: { id: string; purchased: boolean } }).input.id ===
            ITEM_ID &&
          (vars as { input: { id: string; purchased: boolean } }).input
            .purchased === newPurchased,
      },
      result: { data: opts.serverResponse },
      // `delay` makes the network response asynchronous so we can observe
      // the cache between "optimistic write" and "server settle".
      delay: opts.serverDelayMs ?? 0,
    },
  ];

  const client = new ApolloClient({
    cache,
    link: new MockLink(responses),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  return { client, cache };
}

function wrap(client: ApolloClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      ApolloProvider,
      { client, children: children as React.ReactElement },
    );
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('integration: optimistic toggle + cache update', () => {
  it('writes the optimistic purchase status to the cache before the network resolves', async () => {
    const { client, cache } = buildClient({
      initialPurchased: false,
      serverResponse: buildSettledServerResponse(true),
      serverDelayMs: 50, // network is async — observe optimistic-only state first
    });

    expect(readPurchaseStatus(cache)).toBe(false);

    const refetch = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useToggleShoppingItem({ listId: LIST_ID, refetch }),
      { wrapper: wrap(client) },
    );

    let togglePromise: Promise<unknown> | undefined;
    act(() => {
      togglePromise = result.current.toggleItem(ITEM_ID);
    });

    // Optimistic phase: the cache flips before the 50ms network delay
    // elapses. Apollo applies optimistic responses synchronously during
    // the mutate() call, so the cache value should be visible on the next
    // microtask.
    await waitFor(() => {
      expect(readPurchaseStatus(cache)).toBe(true);
    });

    // Settle phase: let the network response arrive and the mutation
    // promise resolve. The cache stays at the (confirmed) value.
    await act(async () => {
      await togglePromise;
    });

    expect(readPurchaseStatus(cache)).toBe(true);
  });

  it('keeps the optimistic value when the server confirms it', async () => {
    const { client, cache } = buildClient({
      initialPurchased: false,
      serverResponse: buildSettledServerResponse(true),
    });

    const refetch = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useToggleShoppingItem({ listId: LIST_ID, refetch }),
      { wrapper: wrap(client) },
    );

    await act(async () => {
      await result.current.toggleItem(ITEM_ID);
    });

    expect(readPurchaseStatus(cache)).toBe(true);
  });

  it('toggles back to unpurchased on a second call', async () => {
    const { client, cache } = buildClient({
      initialPurchased: true,
      serverResponse: buildSettledServerResponse(false),
    });

    expect(readPurchaseStatus(cache)).toBe(true);

    const refetch = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useToggleShoppingItem({ listId: LIST_ID, refetch }),
      { wrapper: wrap(client) },
    );

    await act(async () => {
      await result.current.toggleItem(ITEM_ID);
    });

    expect(readPurchaseStatus(cache)).toBe(false);
  });
});
