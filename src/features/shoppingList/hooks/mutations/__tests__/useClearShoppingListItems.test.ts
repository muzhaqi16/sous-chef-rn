import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { RemoveItemsFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { alertService } from '#/services/alertService';
import { useClearShoppingListItems } from '../useClearShoppingListItems';

jest.mock('#features/shoppingList/cache/connections', () => ({
  clearAllPurchasedItemsFromCache: jest.fn(),
  clearAllUnpurchasedItemsFromCache: jest.fn(),
}));

const {
  clearAllPurchasedItemsFromCache: mockClearAllPurchased,
  clearAllUnpurchasedItemsFromCache: mockClearAllUnpurchased,
} = require('#features/shoppingList/cache/connections');

beforeEach(() => {
  jest.clearAllMocks();
});

interface TestClearItem {
  id: string;
  itemName: string;
  purchaseInfo: { isPurchased: boolean };
}

function createItem(overrides: Partial<TestClearItem> = {}): TestClearItem {
  return {
    id: 'item-1',
    itemName: 'Milk',
    purchaseInfo: { isPurchased: false },
    ...overrides,
  };
}

const clearing = ({ held = false }: { held?: boolean } = {}) =>
  recordMock(RemoveItemsFromShoppingListDocument, {
    held,
    data: {
      removeItemsFromShoppingList: {
        __typename: 'RemoveItemsFromShoppingListPayload',
        summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
        shoppingListItems: [{ id: 'item-1' }],
      },
    },
  });

const refusedClear = () =>
  recordMock(RemoveItemsFromShoppingListDocument, {
    data: {
      removeItemsFromShoppingList: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'nope',
        field: 'ids',
      },
    },
  }).mock;

describe('useClearShoppingListItems', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('does nothing when listId is null', async () => {
    const clear = clearing();
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: null,
          unpurchasedItems: [],
          purchasedItems: [createItem({ purchaseInfo: { isPurchased: true } })],
          refetch: mockRefetch,
        }),
      { operationMocks: [clear.mock] },
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(clear.fired).toEqual([]);
    expect(mockClearAllPurchased).not.toHaveBeenCalled();
  });

  it('does nothing when no target items exist (purchased=true but none purchased)', async () => {
    const clear = clearing();
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [
            createItem({ purchaseInfo: { isPurchased: false } }),
          ],
          purchasedItems: [],
          refetch: mockRefetch,
        }),
      { operationMocks: [clear.mock] },
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(clear.fired).toEqual([]);
    expect(mockClearAllPurchased).not.toHaveBeenCalled();
  });

  it('clears purchased items from cache and fires mutation', async () => {
    const clear = clearing();
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [
            createItem({ id: 'item-2', purchaseInfo: { isPurchased: false } }),
          ],
          purchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: true } }),
            createItem({ id: 'item-3', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [clear.mock] },
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    expect(mockClearAllPurchased).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      ['item-1', 'item-3'],
    );

    // P2-16: the mutation replays the exact captured ids (matching the
    // optimistically-cleared set), not a re-evaluated `purchased` filter.
    expect(clear.fired).toContainEqual({
      input: {
        shoppingListId: 'list-1',
        ids: ['item-1', 'item-3'],
      },
    });
  });

  it('clears unpurchased items from cache and fires mutation', async () => {
    const clear = clearing();
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: false } }),
            createItem({ id: 'item-3', purchaseInfo: { isPurchased: false } }),
          ],
          purchasedItems: [
            createItem({ id: 'item-2', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [clear.mock] },
    );

    await act(async () => {
      await result.current.clearItems(false);
    });

    expect(mockClearAllUnpurchased).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      ['item-1', 'item-3'],
    );

    // P2-16: id-based replay, matching the optimistically-cleared set.
    expect(clear.fired).toContainEqual({
      input: {
        shoppingListId: 'list-1',
        ids: ['item-1', 'item-3'],
      },
    });
  });

  it('prevents concurrent calls via isClearingRef guard', async () => {
    // The first clear is held in flight while the second starts: the
    // isClearingRef guard rejects it without firing a second mutation.
    const clear = clearing({ held: true });
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [],
          purchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [clear.mock] },
    );

    let first: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.clearItems(true);
    });
    await waitFor(() => expect(clear.fired).toHaveLength(1));

    await act(async () => {
      await result.current.clearItems(true);
    });
    await act(async () => {
      clear.release();
      await first;
    });

    expect(clear.fired).toHaveLength(1);
  });

  it('alerts and refetches when the clear is rejected (union error)', async () => {
    const { result } = renderHookWithApollo(
      () =>
        useClearShoppingListItems({
          listId: 'list-1',
          unpurchasedItems: [],
          purchasedItems: [
            createItem({ id: 'item-1', purchaseInfo: { isPurchased: true } }),
          ],
          refetch: mockRefetch,
        }),
      { operationMocks: [refusedClear()] },
    );

    await act(async () => {
      await result.current.clearItems(true);
    });

    // A server refusal surfaces one alert — not a silent revert — and refetches
    // to restore the evicted items.
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
