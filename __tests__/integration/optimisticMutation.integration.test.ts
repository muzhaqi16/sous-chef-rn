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
 *  - the Apollo cache, built by the production `makeCache()`. The seam under
 *    test IS a type policy: `ShoppingListItemPurchaseInfo.merge` clears the
 *    fields a write omits whenever `isPurchased` changes, which is the rule
 *    this file's subject depends on. A bare `InMemoryCache` does not load it,
 *    so the one test that toggles `purchaseInfo.isPurchased` end to end was the
 *    one place that rule could not run — under a docstring that said the cache
 *    was configured the way production's is.
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
import { isDeepStrictEqual } from 'node:util';
import { ApolloClient, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { ApolloProvider } from '@apollo/client/react';
import {
  completeMockedResponse,
  holdMock,
  testMockLink,
  type MockDataFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { useToggleShoppingItem } from '#features/shoppingList/hooks/mutations/useToggleShoppingItem';

// Peripheral mocks — dependencies of the SUT that have nothing to do with
// the cache seam under test. Stubbing them keeps the assertion focused on
// the optimistic + cache-update behavior.
jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    track: jest.fn(() => jest.fn()),
  },
}));

const LIST_ID = 'list-1';
const ITEM_ID = 'item-1';
// The version the cached row holds, which the tick states.
const ITEM_VERSION = 1;

function seedItem(cache: InMemoryCache, isPurchased: boolean) {
  const data: ShoppingListItemDisplayFragment = {
    __typename: 'ShoppingListItem',
    id: ITEM_ID,
    shoppingList: { __typename: 'ShoppingList', id: LIST_ID },
    itemName: 'Milk',
    quantity: 1,
    quantityInput: '1',
    displayFormat: DisplayFormat.Decimal,
    // Two fields, because that is all `ShoppingListItemDisplayFragment`
    // selects — the seed cannot hold more than the fragment it is written
    // through.
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      movedToPantryAt: null,
      isPurchased,
    },
    version: ITEM_VERSION,
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
): MockDataFor<typeof UpdateShoppingListItemDocument> {
  return {
    updateShoppingListItem: {
      __typename: 'UpdateShoppingListItemPayload',
      shoppingListItem: {
        __typename: 'ShoppingListItem',
        id: ITEM_ID,
        // A `purchaseInfo` write replaces the cached one (the type policy in
        // apollo/cache.ts), so the flag is stated and the rest completed.
        purchaseInfo: { isPurchased: newPurchased },
      },
      shoppingList: { __typename: 'ShoppingList', id: LIST_ID },
    },
  };
}

function buildClient(opts: {
  initialPurchased: boolean;
  serverResponse: MockDataFor<typeof UpdateShoppingListItemDocument>;
  /** The server's answer waits for `release()`. */
  held?: boolean;
}) {
  const cache = makeCache();
  seedItem(cache, opts.initialPurchased);

  const newPurchased = !opts.initialPurchased;
  const tick = completeMockedResponse({
    request: {
      query: UpdateShoppingListItemDocument,
      // Matched exactly: the tick carries the flag alone, no amounts.
      variables: vars =>
        isDeepStrictEqual(vars, {
          input: {
            id: ITEM_ID,
            version: ITEM_VERSION,
            purchaseTracking: { isPurchased: newPurchased },
          },
        }),
    },
    result: { data: opts.serverResponse },
  });
  const { mock, release } = opts.held
    ? holdMock(tick)
    : { mock: tick, release: () => {} };
  const responses: MockedResponse[] = [mock];

  const client = new ApolloClient({
    cache,
    link: testMockLink(responses),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  return { client, cache, release };
}

function wrap(client: ApolloClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(ApolloProvider, {
      client,
      children: children as React.ReactElement,
    });
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('integration: optimistic toggle + cache update', () => {
  it('writes the optimistic purchase status to the cache before the network resolves', async () => {
    const { client, cache, release } = buildClient({
      initialPurchased: false,
      serverResponse: buildSettledServerResponse(true),
      held: true,
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

    // Optimistic phase: the cache flips while the server's answer is held.
    // Apollo applies optimistic responses synchronously during the mutate()
    // call, so the cache value is visible on the next microtask.
    await waitFor(() => {
      expect(readPurchaseStatus(cache)).toBe(true);
    });

    // Settle phase: let the network response arrive and the mutation
    // promise resolve. The cache stays at the (confirmed) value.
    await act(async () => {
      release();
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
