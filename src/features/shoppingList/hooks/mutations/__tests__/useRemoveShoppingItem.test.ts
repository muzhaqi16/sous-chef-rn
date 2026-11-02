import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { useRemoveShoppingItem } from '../useRemoveShoppingItem';
import { RemoveItemFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { alertService } from '#/services/alertService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';

const removeMock = () =>
  recordMock(RemoveItemFromShoppingListDocument, {
    data: {
      removeItemFromShoppingList: {
        __typename: 'RemoveItemFromShoppingListPayload',
      },
    },
  });

const refusalMock = (member: {
  __typename: 'ForbiddenError' | 'NotFoundError';
  code?: ErrorCode;
}) =>
  recordMock(RemoveItemFromShoppingListDocument, {
    data: { removeItemFromShoppingList: member },
  });
const goneMock = () =>
  refusalMock({ __typename: 'NotFoundError', code: ErrorCode.NotFound });

beforeEach(() => {
  jest.clearAllMocks();
});

const UNPURCHASED_ROW = {
  __typename: 'ShoppingListItem',
  id: 'item-1',
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: false,
  },
};

describe('useRemoveShoppingItem', () => {
  it('returns removeItem function', () => {
    const removed = removeMock();
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: 'list-1' }),
      { operationMocks: [removed.mock] },
    );

    expect(typeof result.current.removeItem).toBe('function');
  });

  it('does nothing when listId is missing', async () => {
    const removed = removeMock();
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: null }),
      { operationMocks: [removed.mock] },
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(removed.fired).toHaveLength(0);
  });

  describe('a refusal the server returns as data', () => {
    // errorPolicy 'all' resolves a refusal instead of throwing, so `onError`
    // never sees it: the row was already evicted and would stay gone.
    it('restores the row and says so once', async () => {
      const refused = refusalMock({ __typename: 'ForbiddenError' });
      const { result } = renderHookWithApollo(
        () => useRemoveShoppingItem({ listId: 'list-1' }),
        { operationMocks: [refused.mock] },
      );

      let removed: unknown;
      await act(async () => {
        removed = await result.current.removeItem('item-1');
      });

      expect(removed).toBe(false);
      expect(alertService.alert).toHaveBeenCalledTimes(1);
    });

    it('puts the counters back as they were', async () => {
      const cache = seedCache([
        {
          __typename: 'ShoppingList',
          id: 'list-1',
          totalItems: 3,
          completedItems: 1,
        },
        UNPURCHASED_ROW,
      ]);
      const refused = refusalMock({ __typename: 'ForbiddenError' });
      const { result } = renderHookWithApollo(
        () => useRemoveShoppingItem({ listId: 'list-1' }),
        { operationMocks: [refused.mock], cache },
      );

      await act(async () => {
        await result.current.removeItem('item-1');
      });

      expect(cache.extract()['ShoppingList:list-1']).toMatchObject({
        totalItems: 3,
        completedItems: 1,
      });
    });

    it('keeps the removal when the row is already gone', async () => {
      const gone = goneMock();
      const { result } = renderHookWithApollo(
        () => useRemoveShoppingItem({ listId: 'list-1' }),
        { operationMocks: [gone.mock] },
      );

      let removed: unknown;
      await act(async () => {
        removed = await result.current.removeItem('item-1');
      });

      expect(removed).toBe(true);
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    it('reports a removal that lost a race to another as done', async () => {
      // Two removals of one line overlap: the second converges on the first,
      // answering success with no line.
      const converged = recordMock(RemoveItemFromShoppingListDocument, {
        data: {
          removeItemFromShoppingList: {
            __typename: 'RemoveItemFromShoppingListPayload',
            shoppingListItem: null,
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useRemoveShoppingItem({ listId: 'list-1' }),
        { operationMocks: [converged.mock] },
      );

      let removed: unknown;
      await act(async () => {
        removed = await result.current.removeItem('item-1');
      });

      expect(removed).toBe(true);
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    it('reports a landed removal as done', async () => {
      const landed = removeMock();
      const { result } = renderHookWithApollo(
        () => useRemoveShoppingItem({ listId: 'list-1' }),
        { operationMocks: [landed.mock] },
      );

      let removed: unknown;
      await act(async () => {
        removed = await result.current.removeItem('item-1');
      });

      expect(removed).toBe(true);
      expect(alertService.alert).not.toHaveBeenCalled();
    });
  });

  it('adjusts the counts it holds when some are missing', async () => {
    // Cached without `remainingItems` / `completionRate`: the held counts still
    // move rather than all staying stale behind a null strict read.
    const cache = seedCache([
      {
        __typename: 'ShoppingList',
        id: 'list-1',
        totalItems: 3,
        completedItems: 1,
      },
      UNPURCHASED_ROW,
    ]);
    // NotFound: the response writes no list of its own over the local one.
    const gone = goneMock();
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: 'list-1' }),
      { operationMocks: [gone.mock], cache },
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(cache.extract()['ShoppingList:list-1']).toMatchObject({
      totalItems: 2,
      completedItems: 1,
    });
  });

  it('derives no count from an input the cache does not hold', async () => {
    const cache = seedCache([
      {
        __typename: 'ShoppingList',
        id: 'list-1',
        totalItems: 3,
        remainingItems: 2,
        completionRate: 1 / 3,
      },
      UNPURCHASED_ROW,
    ]);
    const gone = goneMock();
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: 'list-1' }),
      { operationMocks: [gone.mock], cache },
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    const list = cache.extract()['ShoppingList:list-1'];
    expect(list).toMatchObject({
      totalItems: 2,
      remainingItems: 2,
      completionRate: 1 / 3,
    });
    expect(list).not.toHaveProperty('completedItems');
  });

  it('keeps the row removed with no alert when the removal is queued', async () => {
    const cache = seedCache([
      {
        __typename: 'ShoppingList',
        id: 'list-1',
        totalItems: 3,
        completedItems: 1,
        remainingItems: 2,
        completionRate: 1 / 3,
      },
      UNPURCHASED_ROW,
    ]);
    const queued = recordMock(RemoveItemFromShoppingListDocument, {
      data: { removeItemFromShoppingList: null },
    });
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: 'list-1' }),
      { operationMocks: [queued.mock], cache },
    );

    let removed: unknown;
    await act(async () => {
      removed = await result.current.removeItem('item-1');
    });

    expect(removed).toBe(true);
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(cache.extract(true)['ShoppingListItem:item-1']).toBeUndefined();
    expect(cache.extract(true)['ShoppingList:list-1']).toMatchObject({
      totalItems: 2,
      remainingItems: 1,
    });
  });
});
