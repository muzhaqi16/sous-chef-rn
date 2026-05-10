import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRemoveShoppingItem } from '../useRemoveShoppingItem';

const mockHandleApolloError = jest.fn(() => ({
  message: 'Something went wrong',
}));
const mockCreateRemoveOperation = jest.fn();

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

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('../utils', () => ({
  removeFromShoppingListItemsCache: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRemoveShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns removeItem function', () => {
    const mockRemoveFn = jest.fn().mockResolvedValue(undefined);
    mockCreateRemoveOperation.mockReturnValue(mockRemoveFn);

    const { result } = renderHookWithApollo(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    expect(typeof result.current.removeItem).toBe('function');
  });

  it('calls createRemoveOperation with correct itemId', async () => {
    const mockRemoveFn = jest.fn().mockResolvedValue(true);
    mockCreateRemoveOperation.mockReturnValue(mockRemoveFn);

    const { result } = renderHookWithApollo(() =>
      useRemoveShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.removeItem('item-123');
    });

    expect(mockCreateRemoveOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: expect.any(Function),
        parentId: 'list-1',
        itemId: 'item-123',
        operationName: 'Delete Shopping List Item',
      }),
    );
  });

  it('calls the created operation function', async () => {
    const mockRemoveFn = jest.fn().mockResolvedValue(true);
    mockCreateRemoveOperation.mockReturnValue(mockRemoveFn);

    const { result } = renderHookWithApollo(() =>
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

    const { result } = renderHookWithApollo(() =>
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
