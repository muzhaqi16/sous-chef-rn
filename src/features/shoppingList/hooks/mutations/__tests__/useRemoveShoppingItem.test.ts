import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { useRemoveShoppingItem } from '../useRemoveShoppingItem';
import { removeFromShoppingListItemsCache } from '../utils';
import { RemoveItemFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';

const removeMock = () =>
  recordMock(RemoveItemFromShoppingListDocument, {
    data: {
      removeItemFromShoppingList: {
        __typename: 'RemoveItemFromShoppingListPayload',
      },
    },
  });

jest.mock('../utils', () => ({
  removeFromShoppingListItemsCache: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRemoveShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns removeItem function', () => {
    const removed = removeMock();
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { operationMocks: [removed.mock] },
    );

    expect(typeof result.current.removeItem).toBe('function');
  });

  it('optimistically evicts the item BEFORE firing the mutation (Pattern B / local-first)', async () => {
    const removed = removeMock();
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { operationMocks: [removed.mock] },
    );

    await act(async () => {
      await result.current.removeItem('item-123');
    });

    expect(removeFromShoppingListItemsCache).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      'item-123',
      { evictItem: true },
    );
    expect(removed.fired).toHaveLength(1);
  });

  it('evicts each item on successive calls', async () => {
    const removed = removeMock();
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      { operationMocks: [removed.mock] },
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });
    await act(async () => {
      await result.current.removeItem('item-2');
    });

    // Asserted per item rather than by call index: each removal evicts twice —
    // once optimistically before firing, once from the mutation's own `update`
    // when the response lands.
    expect(removeFromShoppingListItemsCache).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      'item-1',
      { evictItem: true },
    );
    expect(removeFromShoppingListItemsCache).toHaveBeenCalledWith(
      expect.anything(),
      'list-1',
      'item-2',
      { evictItem: true },
    );
  });

  it('does nothing when listId is missing', async () => {
    const removed = removeMock();
    const { result } = renderHookWithApollo(
      () => useRemoveShoppingItem({ listId: null, refetch: mockRefetch }),
      { operationMocks: [removed.mock] },
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(removeFromShoppingListItemsCache).not.toHaveBeenCalled();
    expect(removed.fired).toHaveLength(0);
  });
});
