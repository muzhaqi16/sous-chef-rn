/**
 * Catalog-merge / concurrency coverage for useAddShoppingItem's `update`
 * callback. Unlike useAddShoppingItem.test.ts (which mocks executeMutation and
 * never runs `update`), this drives the real mutation through Apollo so the
 * catalog-merge branch executes, and asserts it adopts the server id using THIS
 * mutation's own variables — not a shared ref that breaks when adds overlap.
 */

import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { useAddShoppingItem } from '../useAddShoppingItem';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { generateEntityId } from '#/utils/generateEntityId';

// Stub the eviction + connection writers so the catalog-merge branch can be
// asserted in isolation; the mutation itself still flows through Apollo so the
// real `update` callback runs.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/cacheUpdaters'),
  safeEvict: jest.fn(),
}));
// Keep the REAL adoptServerShoppingListItemId / revertOptimisticShoppingListItem
// so the catalog-merge eviction path runs through to the (mocked) safeEvict that
// these assertions watch; stub only the writers.
jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/shoppingListCacheUpdaters'),
  addNewItemToShoppingListCache: jest.fn(),
  addOptimisticShoppingListItem: jest.fn(),
  createOptimisticShoppingListItem: jest.fn((id: string) => ({
    __typename: 'ShoppingListItem',
    id,
    itemName: 'X',
  })),
}));
jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: jest.fn(),
}));

const mockGenerateEntityId = generateEntityId as jest.Mock;
const mockSafeEvict = safeEvict as jest.Mock;

const payloadItem = (id: string) => ({
  __typename: 'ShoppingListItem',
  id,
  itemName: 'Milk',
  quantity: 1,
  quantityInput: null,
  displayFormat: DisplayFormat.Auto,
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: false,
  },
  version: 1,
  updatedAt: '2026-06-04T00:00:00.000Z',
  category: null,
  notes: null,
  unitName: null,
  unit: null,
  sortOrder: '',
  item: null,
  shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
});

// Server echoes back the client-sent id (no catalog merge).
const echoMock = (): MockedResponse => ({
  request: { query: AddItemToShoppingListDocument, variables: () => true },
  maxUsageCount: Number.POSITIVE_INFINITY,
  result: (vars: { input: { id: string } }) => ({
    data: {
      addItemToShoppingList: {
        __typename: 'AddItemToShoppingListPayload',
        shoppingListItem: payloadItem(vars.input.id),
      },
    },
  }),
});

// Server returns a different (canonical) id → a catalog merge happened.
const mergeMock = (canonicalId: string): MockedResponse => ({
  request: { query: AddItemToShoppingListDocument, variables: () => true },
  maxUsageCount: Number.POSITIVE_INFINITY,
  result: () => ({
    data: {
      addItemToShoppingList: {
        __typename: 'AddItemToShoppingListPayload',
        shoppingListItem: payloadItem(canonicalId),
      },
    },
  }),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAddShoppingItem — catalog-merge id adoption', () => {
  const refetch = jest.fn().mockResolvedValue(undefined);

  it('evicts the client cuid when the server returns a different (merged) id', async () => {
    mockGenerateEntityId.mockReturnValueOnce('cuid-A');
    const { result } = renderHookWithApollo(
      () => useAddShoppingItem({ listId: 'list-1', refetch }),
      { operationMocks: [mergeMock('server-canonical')] },
    );

    await act(async () => {
      await result.current.addItem({ itemName: 'Milk', quantity: 1 });
    });

    expect(mockSafeEvict).toHaveBeenCalledWith(
      expect.anything(),
      'ShoppingListItem',
      'cuid-A',
    );
  });

  it('does NOT cross-evict when two adds overlap (regression: per-call variables, not a shared ref)', async () => {
    mockGenerateEntityId
      .mockReturnValueOnce('cuid-A')
      .mockReturnValueOnce('cuid-B');
    const { result } = renderHookWithApollo(
      () => useAddShoppingItem({ listId: 'list-1', refetch }),
      { operationMocks: [echoMock()] },
    );

    await act(async () => {
      await Promise.all([
        result.current.addItem({ itemName: 'A', quantity: 1 }),
        result.current.addItem({ itemName: 'B', quantity: 1 }),
      ]);
    });

    // Each mutation's response echoes its OWN sent id (no merge), so neither
    // item should be evicted. The old single-`lastClientIdRef` implementation
    // evicted whichever id the ref last held — cross-evicting a sibling add.
    expect(mockSafeEvict).not.toHaveBeenCalled();
  });
});
