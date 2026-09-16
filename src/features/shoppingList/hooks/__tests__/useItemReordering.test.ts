import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { MoveShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { alertService } from '#/services/alertService';
import { useItemReordering } from '../useItemReordering';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockGenerateKeyBetween = jest.fn<string, [string | null, string | null]>(
  () => 'bbb',
);
jest.mock('fractional-indexing', () => ({
  generateKeyBetween: (a: string | null, b: string | null) =>
    mockGenerateKeyBetween(a, b),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  SubscriptionService: {
    getInstance: () => ({
      markItemReordered: jest.fn(),
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const items = [
  { id: 'item-1', sortOrder: 'aaa', version: 1 },
  { id: 'item-2', sortOrder: 'ccc', version: 1 },
  { id: 'item-3', sortOrder: 'eee', version: 1 },
];

function moveMock() {
  return recordMock(MoveShoppingListItemDocument, {
    data: {
      moveShoppingListItem: {
        __typename: 'MoveShoppingListItemPayload',
        shoppingListItem: {
          __typename: 'ShoppingListItem',
          id: 'item-2',
          sortOrder: 'bbb',
          version: 2,
        },
      },
    },
  });
}

function moveErrorMock(): MockedResponse {
  return recordMock(MoveShoppingListItemDocument, {
    error: new Error('Server error'),
  }).mock;
}

describe('useItemReordering', () => {
  it('returns handleSortOrderUpdate function', () => {
    const { result } = renderHookWithApollo(() =>
      useItemReordering({ listId: 'list-1', items }),
    );

    expect(typeof result.current.handleSortOrderUpdate).toBe('function');
  });

  it('does nothing when listId is undefined', async () => {
    const m = moveMock();
    const { result } = renderHookWithApollo(
      () => useItemReordering({ listId: undefined, items }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate('item-2', 'item-1', 'item-3');
    });

    expect(m.fired).toEqual([]);
  });

  it('does nothing when item not found in items array', async () => {
    const m = moveMock();
    const { result } = renderHookWithApollo(
      () => useItemReordering({ listId: 'list-1', items }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'non-existent',
        'item-1',
        'item-3',
      );
    });

    expect(m.fired).toEqual([]);
  });

  it('generates new sort order and calls mutation', async () => {
    const m = moveMock();
    const { result } = renderHookWithApollo(
      () => useItemReordering({ listId: 'list-1', items }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate('item-2', 'item-1', 'item-3');
    });

    expect(mockGenerateKeyBetween).toHaveBeenCalledWith('aaa', 'eee');
    expect(m.fired).toContainEqual({
      input: {
        itemId: 'item-2',
        afterItemId: 'item-1',
        beforeItemId: 'item-3',
      },
    });
  });

  it('handles null afterItemId (moving to first position)', async () => {
    const m = moveMock();
    const { result } = renderHookWithApollo(
      () => useItemReordering({ listId: 'list-1', items }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate('item-2', null, 'item-1');
    });

    expect(mockGenerateKeyBetween).toHaveBeenCalledWith(null, 'aaa');
    expect(m.fired).toContainEqual({
      input: {
        itemId: 'item-2',
        afterItemId: undefined,
        beforeItemId: 'item-1',
      },
    });
  });

  it('handles null beforeItemId (moving to last position)', async () => {
    const m = moveMock();
    const { result } = renderHookWithApollo(
      () => useItemReordering({ listId: 'list-1', items }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate('item-2', 'item-3', null);
    });

    expect(mockGenerateKeyBetween).toHaveBeenCalledWith('eee', null);
  });

  it('refetches when sortOrder ordering is invalid (after > before)', async () => {
    const refetch = jest.fn();
    const badItems = [
      { id: 'item-1', sortOrder: 'zzz', version: 1 },
      { id: 'item-2', sortOrder: 'ccc', version: 1 },
      { id: 'item-3', sortOrder: 'aaa', version: 1 },
    ];
    const m = moveMock();
    const { result } = renderHookWithApollo(
      () => useItemReordering({ listId: 'list-1', items: badItems, refetch }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate('item-2', 'item-1', 'item-3');
    });

    expect(refetch).toHaveBeenCalled();
    expect(m.fired).toEqual([]);
  });

  it('handles GraphQL errors from mutation', async () => {
    const refetch = jest.fn();
    const { result } = renderHookWithApollo(
      () => useItemReordering({ listId: 'list-1', items, refetch }),
      { operationMocks: [moveErrorMock()] },
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate('item-2', 'item-1', 'item-3');
    });

    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalled();
  });

  describe('a move queued offline', () => {
    afterEach(() => optimisticDataPersistence.clearAll());

    it('keeps the persisted sortOrder, with no refetch and no alert', async () => {
      const refetch = jest.fn();
      const queued = recordMock(MoveShoppingListItemDocument, {
        data: { moveShoppingListItem: null },
      });
      const { result } = renderHookWithApollo(
        () => useItemReordering({ listId: 'list-1', items, refetch }),
        { operationMocks: [queued.mock] },
      );

      await act(async () => {
        await result.current.handleSortOrderUpdate(
          'item-2',
          'item-1',
          'item-3',
        );
      });
      optimisticDataPersistence.flush();

      expect(queued.fired).toHaveLength(1);
      expect(
        optimisticDataPersistence.get('ShoppingListItem', 'item-2'),
      ).toEqual({ sortOrder: 'bbb' });
      expect(refetch).not.toHaveBeenCalled();
      expect(alertService.alert).not.toHaveBeenCalled();
    });
  });

  describe('a move that does not take effect', () => {
    let clearPersisted: jest.SpyInstance;

    beforeEach(() => {
      clearPersisted = jest.spyOn(optimisticDataPersistence, 'clear');
    });
    afterEach(() => clearPersisted.mockRestore());

    it('restores the server order and says so when the move is refused', async () => {
      // A refusal resolves as data: the row would sit in its unsaved position
      // with the hook logging it as a server update.
      const refetch = jest.fn();
      const refused = recordMock(MoveShoppingListItemDocument, {
        data: { moveShoppingListItem: { __typename: 'ForbiddenError' } },
      });
      const { result } = renderHookWithApollo(
        () => useItemReordering({ listId: 'list-1', items, refetch }),
        { operationMocks: [refused.mock] },
      );

      await act(async () => {
        await result.current.handleSortOrderUpdate(
          'item-2',
          'item-1',
          'item-3',
        );
      });

      expect(refetch).toHaveBeenCalledTimes(1);
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(clearPersisted).toHaveBeenCalledWith(
        'ShoppingListItem',
        'item-2',
        'sortOrder',
      );
    });

    it('restores the server order when the move fails', async () => {
      const refetch = jest.fn();
      const failed = recordMock(MoveShoppingListItemDocument, {
        error: new Error('socket closed'),
      });
      const { result } = renderHookWithApollo(
        () => useItemReordering({ listId: 'list-1', items, refetch }),
        { operationMocks: [failed.mock] },
      );

      await act(async () => {
        await result.current.handleSortOrderUpdate(
          'item-2',
          'item-1',
          'item-3',
        );
      });

      expect(refetch).toHaveBeenCalledTimes(1);
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(clearPersisted).toHaveBeenCalledWith(
        'ShoppingListItem',
        'item-2',
        'sortOrder',
      );
    });
  });
});
