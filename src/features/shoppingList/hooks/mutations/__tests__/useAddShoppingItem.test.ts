import { renderHook } from '@testing-library/react-native';
import { useAddShoppingItem } from '../useAddShoppingItem';

// --- Mocks ---

const mockAddItemMutation = jest.fn();
const mockHandleApolloError = jest.fn(() => ({
  message: 'Something went wrong',
}));
const mockCreateAddOperation = jest.fn();

// Mock generated Apollo hook
jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'AddItemToShoppingList')
      return [mockAddItemMutation, { loading: false }];
    return [jest.fn(), {}];
  }),
}));

// Mock errorService
jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: mockHandleApolloError,
  }),
}));

// Mock useCrudOperations
jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: () => ({
    createAddOperation: mockCreateAddOperation,
  }),
}));

// Mock compilerSafeWrappers
jest.mock('#/utils/compilerSafeWrappers');

// Mock cache updaters
jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  addNewItemToShoppingListCache: jest.fn(),
}));

// Mock utils
jest.mock('../utils', () => ({
  createOptimisticShoppingListItem: jest.fn(() => ({
    tempId: 'temp-123',
    entity: {
      id: 'temp-123',
      itemName: 'Milk',
      __typename: 'ShoppingListItem',
    },
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAddShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);

  it('returns addItem function', () => {
    const mockAddFn = jest.fn();
    mockCreateAddOperation.mockReturnValue(mockAddFn);

    const { result } = renderHook(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    expect(result.current.addItem).toBe(mockAddFn);
  });

  it('configures createAddOperation with correct params', () => {
    mockCreateAddOperation.mockReturnValue(jest.fn());

    renderHook(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    expect(mockCreateAddOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: mockAddItemMutation,
        operationName: 'Add Shopping List Item',
      }),
    );
  });

  it('transformInput includes shoppingListId and itemName', () => {
    mockCreateAddOperation.mockReturnValue(jest.fn());

    renderHook(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    const config = mockCreateAddOperation.mock.calls[0][0];
    const transformed = config.transformInput({
      itemName: 'Eggs',
      quantity: 2,
    });

    expect(transformed).toEqual(
      expect.objectContaining({
        shoppingListId: 'list-1',
        itemName: 'Eggs',
        quantity: 2,
      }),
    );
  });

  it('transformInput defaults quantity to 1 when not provided', () => {
    mockCreateAddOperation.mockReturnValue(jest.fn());

    renderHook(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    const config = mockCreateAddOperation.mock.calls[0][0];
    const transformed = config.transformInput({ itemName: 'Eggs' });

    expect(transformed.quantity).toBe(1);
  });

  it('transformInput includes optional unitName when provided', () => {
    mockCreateAddOperation.mockReturnValue(jest.fn());

    renderHook(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    const config = mockCreateAddOperation.mock.calls[0][0];
    const transformed = config.transformInput({
      itemName: 'Milk',
      unitName: 'gallon',
    });

    expect(transformed.unit.unitName).toBe('gallon');
  });

  it('transformInput omits optional fields when empty', () => {
    mockCreateAddOperation.mockReturnValue(jest.fn());

    renderHook(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    const config = mockCreateAddOperation.mock.calls[0][0];
    const transformed = config.transformInput({
      itemName: 'Milk',
    });

    expect(transformed).not.toHaveProperty('unit');
    expect(transformed).not.toHaveProperty('notes');
    expect(transformed).not.toHaveProperty('category');
  });

  it('parentId resolver returns the listId', () => {
    mockCreateAddOperation.mockReturnValue(jest.fn());

    renderHook(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    const config = mockCreateAddOperation.mock.calls[0][0];
    const parentId = config.parentId();
    expect(parentId).toBe('list-1');
  });

  it('onSuccess extracts addItemToShoppingList from data', () => {
    mockCreateAddOperation.mockReturnValue(jest.fn());

    renderHook(() =>
      useAddShoppingItem({ listId: 'list-1', refetch: mockRefetch }),
    );

    const config = mockCreateAddOperation.mock.calls[0][0];
    const result = config.onSuccess({
      addItemToShoppingList: { shoppingListItem: { id: 'item-1' } },
    });

    expect(result).toEqual({ shoppingListItem: { id: 'item-1' } });
  });
});
