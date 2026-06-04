import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useAddShoppingItem } from '../useAddShoppingItem';
import { addOptimisticShoppingListItem } from '#/apollo/utils/shoppingListCacheUpdaters';
import { executeMutation } from '#/utils/compilerSafeWrappers';

// Run the optimistic cache update synchronously; don't fire the real mutation.
jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeCacheUpdate: jest.fn((fn: () => void) => fn()),
  executeMutation: jest.fn(async () => ({
    data: {
      addItemToShoppingList: {
        __typename: 'AddItemToShoppingListPayload',
        shoppingListItem: { id: 'srv-1' },
      },
    },
  })),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  addNewItemToShoppingListCache: jest.fn(),
  addOptimisticShoppingListItem: jest.fn(),
  // New signature: (id, fields) => entity (the cuid is baked straight in).
  createOptimisticShoppingListItem: jest.fn(
    (id: string, fields: { itemName?: string }) => ({
      __typename: 'ShoppingListItem',
      id,
      itemName: fields?.itemName ?? '',
    }),
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAddShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns addItem function', () => {
    const { result } = renderHookWithApollo(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    expect(typeof result.current.addItem).toBe('function');
  });

  it('writes the new item PERMANENTLY with a client-minted cuid id BEFORE firing the mutation (Pattern B / local-first)', async () => {
    const { result } = renderHookWithApollo(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.addItem({ itemName: 'Milk', quantity: 2 });
    });

    // The optimistic item was written with a real cuid v1 id (the row's PK).
    expect(addOptimisticShoppingListItem).toHaveBeenCalledTimes(1);
    const writtenItem = (addOptimisticShoppingListItem as jest.Mock).mock
      .calls[0][2];
    expect(writtenItem.id).toMatch(/^c[a-z0-9]{24}$/);

    // The create mutation was then fired.
    expect(executeMutation).toHaveBeenCalled();
  });

  it('does nothing when listId is missing', async () => {
    const { result } = renderHookWithApollo(() =>
      useAddShoppingItem({ listId: null, refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.addItem({ itemName: 'Milk' });
    });

    expect(addOptimisticShoppingListItem).not.toHaveBeenCalled();
    expect(executeMutation).not.toHaveBeenCalled();
  });
});
