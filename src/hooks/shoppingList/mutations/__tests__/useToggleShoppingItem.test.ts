import { renderHook, act } from '@testing-library/react-native';
import { useToggleShoppingItem } from '../useToggleShoppingItem';

// --- Mocks ---

const mockToggleMutation = jest.fn();
const mockHandleApolloError = jest.fn(() => ({ message: 'Toggle error' }));
const mockReadFragment = jest.fn();
const mockIdentify = jest.fn((obj: any) => `${obj.__typename}:${obj.id}`);

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useToggleShoppingListItemPurchasedMutation: () => [mockToggleMutation],
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    cache: {
      readFragment: mockReadFragment,
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
    mockReadFragment.mockReturnValue(createItem({ purchaseInfo: { isPurchased: false } }));
    mockToggleMutation.mockResolvedValue({
      data: {
        toggleShoppingListItemPurchased: {
          shoppingListItem: { id: 'item-1', purchaseInfo: { isPurchased: true } },
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
    mockReadFragment.mockReturnValue(createItem({ purchaseInfo: { isPurchased: true } }));
    mockToggleMutation.mockResolvedValue({
      data: {
        toggleShoppingListItemPurchased: {
          shoppingListItem: { id: 'item-1', purchaseInfo: { isPurchased: false } },
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
});
