import { renderHook, act } from '@testing-library/react-native';
import { useRemoveShoppingItem } from '../useRemoveShoppingItem';

// --- Mocks ---

const mockRemoveItemMutation = jest.fn();
const mockHandleApolloError = jest.fn(() => ({ message: 'Something went wrong' }));
const mockCreateRemoveOperation = jest.fn();

jest.mock('#generated', () => ({
  useRemoveItemFromShoppingListMutation: () => [mockRemoveItemMutation],
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: mockHandleApolloError,
  }),
}));

jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: () => ({
    createRemoveOperation: mockCreateRemoveOperation,
  }),
}));

jest.mock('#/apollo/utils/optimisticTypes', () => ({
  buildOptimisticDeleteResponse: jest.fn(() => ({
    __typename: 'Mutation',
    removeItemFromShoppingList: {
      __typename: 'ShoppingListItemPayload',
      success: true,
    },
  })),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('../utils', () => ({
  removeFromShoppingListItemsCache: jest.fn(),
}));

// Mock gql (needed for fragment definition in the hook)
jest.mock('@apollo/client', () => ({
  gql: jest.fn((strings: TemplateStringsArray) => strings.join('')),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRemoveShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns removeItem function', () => {
    const mockRemoveFn = jest.fn().mockResolvedValue(undefined);
    mockCreateRemoveOperation.mockReturnValue(mockRemoveFn);

    const { result } = renderHook(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    expect(typeof result.current.removeItem).toBe('function');
  });

  it('calls createRemoveOperation with correct itemId', async () => {
    const mockRemoveFn = jest.fn().mockResolvedValue(true);
    mockCreateRemoveOperation.mockReturnValue(mockRemoveFn);

    const { result } = renderHook(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.removeItem('item-123');
    });

    expect(mockCreateRemoveOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: mockRemoveItemMutation,
        parentId: 'list-1',
        itemId: 'item-123',
        operationName: 'Delete Shopping List Item',
      }),
    );
  });

  it('calls the created operation function', async () => {
    const mockRemoveFn = jest.fn().mockResolvedValue(true);
    mockCreateRemoveOperation.mockReturnValue(mockRemoveFn);

    const { result } = renderHook(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.removeItem('item-123');
    });

    expect(mockRemoveFn).toHaveBeenCalled();
  });

  it('creates a new remove operation for each call with different itemId', async () => {
    const mockRemoveFn = jest.fn().mockResolvedValue(true);
    mockCreateRemoveOperation.mockReturnValue(mockRemoveFn);

    const { result } = renderHook(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    await act(async () => {
      await result.current.removeItem('item-2');
    });

    expect(mockCreateRemoveOperation).toHaveBeenCalledTimes(2);
    expect(mockCreateRemoveOperation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ itemId: 'item-1' }),
    );
    expect(mockCreateRemoveOperation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ itemId: 'item-2' }),
    );
  });
});
