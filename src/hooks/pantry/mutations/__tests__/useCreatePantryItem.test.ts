import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useCreatePantryItem } from '../useCreatePantryItem';

const mockCreateMutation = jest.fn();
const mockRestockMutation = jest.fn();

jest.mock('#generated', () => ({
  useCreatePantryItemMutation: jest.fn(() => [mockCreateMutation]),
  useRestockPantryItemMutation: jest.fn(() => [mockRestockMutation]),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Create error' })),
  }),
}));

jest.mock('#/utils/errors/pantryItemDuplicate', () => ({
  isPantryItemDuplicateError: jest.fn(() => false),
  getPantryItemDuplicateInfo: jest.fn(() => null),
}));

jest.mock('../utils', () => ({
  addToPantryItemsCache: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeCacheUpdate: jest.fn((fn: () => void) => fn()),
  executeMutation: jest.fn(async (fn: () => Promise<any>) => fn()),
}));

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
});

const createFormInput = (overrides: Record<string, any> = {}) =>
  ({
    itemName: 'Milk',
    selectedItemId: null,
    brand: '',
    quantityInput: '2',
    unit: 'L',
    storageState: 'PANTRY',
    location: '',
    expirationDate: undefined,
    notes: '',
    category: '',
    minQuantity: '',
    restockQuantity: '',
    netWeight: '',
    netWeightUnitId: '',
    ...overrides,
  }) as any;

describe('useCreatePantryItem', () => {
  it('returns createPantryItem function', () => {
    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    expect(typeof result.current.createPantryItem).toBe('function');
  });

  it('shows alert and returns false when itemName is empty', async () => {
    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    let success: boolean;
    await act(async () => {
      success = await result.current.createPantryItem({
        input: createFormInput({ itemName: '  ' }),
        pantryId: 'pantry-1',
        quantityValue: 2,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    expect(success!).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter an item name');
    expect(mockCreateMutation).not.toHaveBeenCalled();
  });

  it('returns true and calls onSuccess on successful creation', async () => {
    const onSuccess = jest.fn();
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: true, pantryItem: { id: 'new-item' } } },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1', onSuccess }),
    );

    let success: boolean;
    await act(async () => {
      success = await result.current.createPantryItem({
        input: createFormInput(),
        pantryId: 'pantry-1',
        quantityValue: 2,
        unitId: 'unit-L',
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    expect(success!).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('sends correct variables for new item creation', async () => {
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: true, pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({
          itemName: 'Eggs',
          brand: 'Free Range',
          category: 'Dairy',
          notes: 'Organic',
          storageState: 'REFRIGERATOR',
        }),
        pantryId: 'pantry-1',
        quantityValue: 12,
        unitId: 'unit-ea',
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    const callArgs = mockCreateMutation.mock.calls[0][0];
    const input = callArgs.variables.input;

    expect(input.pantryId).toBe('pantry-1');
    expect(input.quantity).toBe(12);
    expect(input.unit).toEqual({ unitId: 'unit-ea' });
    expect(input.item.name).toBe('Eggs');
    expect(input.item.brand).toBe('Free Range');
    expect(input.item.category).toBe('Dairy');
    expect(input.storage.storageState).toBe('REFRIGERATOR');
  });

  it('sends itemId for existing catalog item', async () => {
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: true, pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({ selectedItemId: 'catalog-item-1' }),
        pantryId: 'pantry-1',
        quantityValue: 1,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    const input = mockCreateMutation.mock.calls[0][0].variables.input;
    expect(input.itemId).toBe('catalog-item-1');
    expect(input.item).toBeUndefined();
  });

  it('uses selectedLocationId for storageLocationId', async () => {
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: true, pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({ location: 'Top Shelf' }),
        pantryId: 'pantry-1',
        quantityValue: 1,
        unitId: null,
        selectedLocationId: 'loc-1',
        selectedCategoryId: null,
      });
    });

    const storage = mockCreateMutation.mock.calls[0][0].variables.input.storage;
    expect(storage.storageLocationId).toBe('loc-1');
    expect(storage.storageLocationName).toBeUndefined();
  });

  it('uses storageLocationName when no selectedLocationId', async () => {
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: true, pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({ location: 'Top Shelf' }),
        pantryId: 'pantry-1',
        quantityValue: 1,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    const storage = mockCreateMutation.mock.calls[0][0].variables.input.storage;
    expect(storage.storageLocationName).toBe('Top Shelf');
  });

  it('uses selectedCategoryId over inline category text', async () => {
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: true, pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({ category: 'Dairy' }),
        pantryId: 'pantry-1',
        quantityValue: 1,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: 'cat-1',
      });
    });

    const item = mockCreateMutation.mock.calls[0][0].variables.input.item;
    expect(item.category).toBe('cat-1');
  });

  it('includes thresholds when minQuantity or restockQuantity provided', async () => {
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: true, pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({ minQuantity: '2', restockQuantity: '5' }),
        pantryId: 'pantry-1',
        quantityValue: 3,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    const input = mockCreateMutation.mock.calls[0][0].variables.input;
    expect(input.thresholds).toEqual({ minQuantity: 2, restockQuantity: 5 });
  });

  it('includes netWeight when provided', async () => {
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: true, pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({ netWeight: '500', netWeightUnitId: 'unit-g' }),
        pantryId: 'pantry-1',
        quantityValue: 1,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    const input = mockCreateMutation.mock.calls[0][0].variables.input;
    expect(input.netWeight).toEqual({ netWeight: 500, netWeightUnitId: 'unit-g' });
  });

  it('shows error alert on non-duplicate error', async () => {
    mockCreateMutation.mockResolvedValue({
      data: { createPantryItem: { success: false } },
      error: { message: 'Server error' },
    });

    const { result } = renderHook(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    let success: boolean;
    await act(async () => {
      success = await result.current.createPantryItem({
        input: createFormInput(),
        pantryId: 'pantry-1',
        quantityValue: 1,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    expect(success!).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Create error');
  });
});
