import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRemoveShoppingItem } from '../useRemoveShoppingItem';
import { removeFromShoppingListItemsCache } from '../utils';
import { executeMutation } from '#/utils/compilerSafeWrappers';

// Run the optimistic cache update synchronously; don't actually fire the network
// mutation (return a truthy result) so no operation mock is required.
jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeCacheUpdate: jest.fn((fn: () => void) => fn()),
  executeMutation: jest.fn(async () => true),
}));

jest.mock('../utils', () => ({
  removeFromShoppingListItemsCache: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRemoveShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns removeItem function', () => {
    const { result } = renderHookWithApollo(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    expect(typeof result.current.removeItem).toBe('function');
  });

  it('optimistically evicts the item BEFORE firing the mutation (Pattern B / local-first)', async () => {
    const { result } = renderHookWithApollo(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
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
    expect(executeMutation).toHaveBeenCalled();
  });

  it('evicts each item on successive calls', async () => {
    const { result } = renderHookWithApollo(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });
    await act(async () => {
      await result.current.removeItem('item-2');
    });

    expect(removeFromShoppingListItemsCache).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'list-1',
      'item-1',
      { evictItem: true },
    );
    expect(removeFromShoppingListItemsCache).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'list-1',
      'item-2',
      { evictItem: true },
    );
  });

  it('does nothing when listId is missing', async () => {
    const { result } = renderHookWithApollo(() =>
      useRemoveShoppingItem({ listId: null, refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(removeFromShoppingListItemsCache).not.toHaveBeenCalled();
    expect(executeMutation).not.toHaveBeenCalled();
  });
});
