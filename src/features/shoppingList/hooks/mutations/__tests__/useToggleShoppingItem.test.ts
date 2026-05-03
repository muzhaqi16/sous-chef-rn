import { renderHook, act } from '@testing-library/react-native';
import { useToggleShoppingItem } from '../useToggleShoppingItem';

// --- Mocks ---

const mockToggleMutation = jest.fn();
const mockHandleApolloError = jest.fn(() => ({ message: 'Toggle error' }));
const mockReadFragment = jest.fn();
const mockReadQuery = jest.fn();
const mockIdentify = jest.fn((obj: any) => `${obj.__typename}:${obj.id}`);

let capturedMutationOptions: Record<string, any> = {};

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useToggleShoppingListItemPurchasedMutation: (options: any) => {
    capturedMutationOptions = options;
    return [mockToggleMutation];
  },
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    cache: {
      readFragment: mockReadFragment,
      readQuery: mockReadQuery,
      identify: mockIdentify,
    },
  }),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: mockHandleApolloError,
  }),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  moveShoppingListItemToPurchased: jest.fn(),
  moveShoppingListItemToUnpurchased: jest.fn(),
}));

jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    save: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));

jest.mock('#/utils/compilerSafeWrappers');

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    itemName: 'Milk',
    quantity: 1,
    purchaseInfo: { isPurchased: false },
    version: 1,
    ...overrides,
  } as any;
}

describe('useToggleShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns toggleItem function', () => {
    const { result } = renderHook(() =>
      useToggleShoppingItem({
        listId: 'list-1',
        refetch: mockRefetch,
      }),
    );

    expect(typeof result.current.toggleItem).toBe('function');
  });

  it('returns false when listId is null', async () => {
    const { result } = renderHook(() =>
      useToggleShoppingItem({
        listId: null,
        refetch: mockRefetch,
      }),
    );

    let toggleResult: any;
    await act(async () => {
      toggleResult = await result.current.toggleItem('item-1');
    });

    expect(toggleResult).toBe(false);
    expect(mockToggleMutation).not.toHaveBeenCalled();
  });

  it('returns false when item is not found in cache', async () => {
    mockReadFragment.mockReturnValue(null);

    const { result } = renderHook(() =>
      useToggleShoppingItem({
        listId: 'list-1',
        refetch: mockRefetch,
      }),
    );

    let toggleResult: any;
    await act(async () => {
      toggleResult = await result.current.toggleItem('non-existent');
    });

    expect(toggleResult).toBe(false);
    expect(mockToggleMutation).not.toHaveBeenCalled();
  });

  it('calls mutation with correct variables to mark as purchased', async () => {
    mockReadFragment.mockReturnValue(
      createItem({ purchaseInfo: { isPurchased: false } }),
    );
    mockToggleMutation.mockResolvedValue({
      data: {
        toggleShoppingListItemPurchased: {
          shoppingListItem: {
            id: 'item-1',
            purchaseInfo: { isPurchased: true },
          },
        },
      },
    });

    const { result } = renderHook(() =>
      useToggleShoppingItem({
        listId: 'list-1',
        refetch: mockRefetch,
      }),
    );

    await act(async () => {
      await result.current.toggleItem('item-1');
    });

    expect(mockToggleMutation).toHaveBeenCalledWith({
      variables: { input: { id: 'item-1', purchased: true } },
    });
  });

  it('calls mutation with correct variables to mark as unpurchased', async () => {
    mockReadFragment.mockReturnValue(
      createItem({ purchaseInfo: { isPurchased: true } }),
    );
    mockToggleMutation.mockResolvedValue({
      data: {
        toggleShoppingListItemPurchased: {
          shoppingListItem: {
            id: 'item-1',
            purchaseInfo: { isPurchased: false },
          },
        },
      },
    });

    const { result } = renderHook(() =>
      useToggleShoppingItem({
        listId: 'list-1',
        refetch: mockRefetch,
      }),
    );

    await act(async () => {
      await result.current.toggleItem('item-1');
    });

    expect(mockToggleMutation).toHaveBeenCalledWith({
      variables: { input: { id: 'item-1', purchased: false } },
    });
  });

  it('returns the shoppingListItem from mutation result on success', async () => {
    mockReadFragment.mockReturnValue(createItem());
    const returnedItem = { id: 'item-1', purchaseInfo: { isPurchased: true } };
    mockToggleMutation.mockResolvedValue({
      data: {
        toggleShoppingListItemPurchased: {
          shoppingListItem: returnedItem,
        },
      },
    });

    const { result } = renderHook(() =>
      useToggleShoppingItem({
        listId: 'list-1',
        refetch: mockRefetch,
      }),
    );

    let toggleResult: any;
    await act(async () => {
      toggleResult = await result.current.toggleItem('item-1');
    });

    expect(toggleResult).toEqual(returnedItem);
  });

  it('returns false when mutation returns null result', async () => {
    mockReadFragment.mockReturnValue(createItem());
    mockToggleMutation.mockResolvedValue({
      data: null,
    });

    const { result } = renderHook(() =>
      useToggleShoppingItem({
        listId: 'list-1',
        refetch: mockRefetch,
      }),
    );

    let toggleResult: any;
    await act(async () => {
      toggleResult = await result.current.toggleItem('item-1');
    });

    expect(toggleResult).toBe(false);
  });

  describe('depletion recovery (onCompleted)', () => {
    it('refetches when source connection is depleted after toggle', () => {
      mockReadQuery.mockReturnValue({
        shoppingList: {
          itemsConnection: {
            edges: [],
            totalCount: 20,
          },
        },
      });

      renderHook(() =>
        useToggleShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      );

      // Simulate server confirming a toggle to purchased
      // → source connection is unpurchased (isPurchased: false)
      capturedMutationOptions.onCompleted({
        toggleShoppingListItemPurchased: {
          shoppingListItem: {
            id: 'item-1',
            purchaseInfo: { isPurchased: true },
          },
        },
      });

      expect(mockReadQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({ isPurchased: false }),
        }),
      );
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('does not refetch when source connection still has items', () => {
      mockReadQuery.mockReturnValue({
        shoppingList: {
          itemsConnection: {
            edges: [{ cursor: 'c1', node: { id: 'item-2' } }],
            totalCount: 5,
          },
        },
      });

      renderHook(() =>
        useToggleShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      );

      capturedMutationOptions.onCompleted({
        toggleShoppingListItemPurchased: {
          shoppingListItem: {
            id: 'item-1',
            purchaseInfo: { isPurchased: true },
          },
        },
      });

      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it('does not refetch when totalCount is 0', () => {
      mockReadQuery.mockReturnValue({
        shoppingList: {
          itemsConnection: {
            edges: [],
            totalCount: 0,
          },
        },
      });

      renderHook(() =>
        useToggleShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
      );

      capturedMutationOptions.onCompleted({
        toggleShoppingListItemPurchased: {
          shoppingListItem: {
            id: 'item-1',
            purchaseInfo: { isPurchased: true },
          },
        },
      });

      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });
});
