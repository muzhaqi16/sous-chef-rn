import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { MoveShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { handleMutationError } from '#/utils/errorHandlers';
import { useItemReordering } from '../useItemReordering';

const mockGenerateKeyBetween = jest.fn<string, [string | null, string | null]>(
  () => 'bbb',
);
jest.mock('fractional-indexing', () => ({
  generateKeyBetween: (a: string | null, b: string | null) =>
    mockGenerateKeyBetween(a, b),
}));

jest.mock('#/utils/errorHandlers', () => ({
  handleMutationError: jest.fn(),
  versionConflictCheck: jest.fn(() => ({
    detect: jest.fn(),
    handle: jest.fn(),
  })),
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
        __typename: 'ShoppingListItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
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

    expect(handleMutationError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: 'Move Item',
        checks: expect.any(Array),
      }),
    );
    expect(refetch).toHaveBeenCalled();
  });
});
