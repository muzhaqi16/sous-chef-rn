import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useAddShoppingItem } from '../useAddShoppingItem';
import { addOptimisticShoppingListItem } from '#/apollo/utils/shoppingListCacheUpdaters';
import { executeMutation } from '#/utils/compilerSafeWrappers';

// Run the optimistic cache update synchronously; don't fire the real mutation.
// The mocked result mirrors the real batch payload the hook reads
// (`addItemsToShoppingList.results[0].item`) so the real reconciler classifies
// it as a success and keeps the optimistic row.
jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeCacheUpdate: jest.fn((fn: () => void) => fn()),
  executeMutation: jest.fn(async () => ({
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [
          {
            __typename: 'BatchAddShoppingListItemResult',
            success: true,
            item: { __typename: 'ShoppingListItem', id: 'srv-1' },
          },
        ],
      },
    },
  })),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => {
  const actual = jest.requireActual('#/apollo/utils/shoppingListCacheUpdaters');
  return {
    // Keep the REAL reconcileShoppingCreate (and the classifyCreateResult it
    // calls) so the keep/revert decision under test is production's — a
    // hand-copied reconciler drifts from the operation names it hard-codes.
    ...actual,
    // Leaf cache writers are stubbed so the hook runs without a live cache.
    addNewItemToShoppingListCache: jest.fn(),
    adoptServerShoppingListItemId: jest.fn(),
    revertOptimisticShoppingListItem: jest.fn(),
    addOptimisticShoppingListItem: jest.fn(),
    // Signature: (id, fields) => entity (the cuid is baked straight in).
    createOptimisticShoppingListItem: jest.fn(
      (id: string, fields: { itemName?: string }) => ({
        __typename: 'ShoppingListItem',
        id,
        itemName: fields?.itemName ?? '',
      }),
    ),
  };
});

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

    // The optimistic item was written with a real cuid2 id (the row's PK).
    expect(addOptimisticShoppingListItem).toHaveBeenCalledTimes(1);
    const writtenItem = (addOptimisticShoppingListItem as jest.Mock).mock
      .calls[0][2];
    // Matches the server id validator (cuid2 or legacy cuid v1 / 24-char hex).
    expect(writtenItem.id).toMatch(
      /^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/,
    );

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
