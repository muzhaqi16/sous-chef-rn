import { renderHook, act } from '@testing-library/react-native';
import { useUpdateShoppingItem } from '../useUpdateShoppingItem';

// --- Mocks ---

const mockUpdateItemMutation = jest.fn();
const mockHandleApolloError = jest.fn(() => ({ message: 'Update error' }));

jest.mock('#generated', () => ({
  useUpdateShoppingListItemMutation: () => [mockUpdateItemMutation],
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: mockHandleApolloError,
  }),
}));

jest.mock('#/apollo/utils/optimisticTypes', () => ({
  buildOptimisticMutationResponse: jest.fn(
    (_field: string, _payloadType: string, _entityField: string, entity: any) => ({
      __typename: 'Mutation',
      updateShoppingListItem: {
        __typename: 'ShoppingListItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        shoppingListItem: entity,
      },
    }),
  ),
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Item was updated by someone else'),
}));

jest.mock('#/utils/compilerSafeWrappers');

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    quantityInput: '2',
    category: 'Dairy',
    unitName: 'gallon',
    unit: { id: 'unit-1', name: 'gallon', symbol: 'gal' },
    sortOrder: 'aaa',
    item: null,
    purchaseInfo: { isPurchased: false },
    version: 1,
    ...overrides,
  } as any;
}

describe('useUpdateShoppingItem', () => {
  const mockRefetch = jest.fn().mockResolvedValue(undefined);
  const items = [createItem()];

  it('returns updateItem function', () => {
    const { result } = renderHook(() =>
      useUpdateShoppingItem({ listId: 'list-1', items, refetch: mockRefetch }),
    );

    expect(typeof result.current.updateItem).toBe('function');
  });

  it('returns false when listId is null', async () => {
    const { result } = renderHook(() =>
      useUpdateShoppingItem({ listId: null, items, refetch: mockRefetch }),
    );

    let updateResult: any;
    await act(async () => {
      updateResult = await result.current.updateItem('item-1', { quantity: 3 });
    });

    expect(updateResult).toBe(false);
    expect(mockUpdateItemMutation).not.toHaveBeenCalled();
  });

  it('returns false when item not found in items array', async () => {
    const { result } = renderHook(() =>
      useUpdateShoppingItem({ listId: 'list-1', items, refetch: mockRefetch }),
    );

    let updateResult: any;
    await act(async () => {
      updateResult = await result.current.updateItem('non-existent', { quantity: 3 });
    });

    expect(updateResult).toBe(false);
    expect(mockUpdateItemMutation).not.toHaveBeenCalled();
  });

  it('calls mutation with correct variables including version', async () => {
    mockUpdateItemMutation.mockResolvedValue({
      data: {
        updateShoppingListItem: { success: true },
      },
    });

    const { result } = renderHook(() =>
      useUpdateShoppingItem({ listId: 'list-1', items, refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.updateItem('item-1', { quantity: 5 });
    });

    expect(mockUpdateItemMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          id: 'item-1',
          input: { quantity: 5, version: 1 },
        },
      }),
    );
  });

  it('returns true when mutation succeeds', async () => {
    mockUpdateItemMutation.mockResolvedValue({
      data: {
        updateShoppingListItem: { success: true },
      },
    });

    const { result } = renderHook(() =>
      useUpdateShoppingItem({ listId: 'list-1', items, refetch: mockRefetch }),
    );

    let updateResult: any;
    await act(async () => {
      updateResult = await result.current.updateItem('item-1', { quantity: 3 });
    });

    expect(updateResult).toBe(true);
  });

  it('returns false when mutation result has no data', async () => {
    mockUpdateItemMutation.mockResolvedValue({
      data: null,
    });

    const { result } = renderHook(() =>
      useUpdateShoppingItem({ listId: 'list-1', items, refetch: mockRefetch }),
    );

    let updateResult: any;
    await act(async () => {
      updateResult = await result.current.updateItem('item-1', { quantity: 3 });
    });

    expect(updateResult).toBe(false);
  });

  it('passes optimisticResponse with updated fields', async () => {
    mockUpdateItemMutation.mockResolvedValue({
      data: {
        updateShoppingListItem: { success: true },
      },
    });

    const { result } = renderHook(() =>
      useUpdateShoppingItem({ listId: 'list-1', items, refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.updateItem('item-1', { itemName: 'Whole Milk' });
    });

    // Verify optimisticResponse was passed to mutation
    expect(mockUpdateItemMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        optimisticResponse: expect.any(Object),
      }),
    );
  });

  it('uses existing item values when updates do not specify them', async () => {
    const { buildOptimisticMutationResponse } = require('#/apollo/utils/optimisticTypes');

    mockUpdateItemMutation.mockResolvedValue({
      data: {
        updateShoppingListItem: { success: true },
      },
    });

    const { result } = renderHook(() =>
      useUpdateShoppingItem({ listId: 'list-1', items, refetch: mockRefetch }),
    );

    await act(async () => {
      await result.current.updateItem('item-1', { quantity: 5 });
    });

    // buildOptimisticMutationResponse should receive item fields with updated quantity
    expect(buildOptimisticMutationResponse).toHaveBeenCalledWith(
      'updateShoppingListItem',
      'ShoppingListItemPayload',
      'shoppingListItem',
      expect.objectContaining({
        id: 'item-1',
        itemName: 'Milk', // unchanged
        quantity: 5,       // updated
        category: 'Dairy', // unchanged
      }),
    );
  });
});
