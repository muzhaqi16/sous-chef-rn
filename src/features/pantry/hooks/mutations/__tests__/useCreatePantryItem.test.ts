import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { ItemCondition } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import {
  getPantryItemDuplicateInfoFromPayload,
  promptPantryDuplicate,
} from '#/utils/errors/pantryItemDuplicate';
import type { FormDataInput } from '../types';
import { useCreatePantryItem } from '../useCreatePantryItem';

jest.mock('#/utils/errorHandlers', () => ({
  handleMutationError: jest.fn(),
}));

jest.mock('#/utils/errors/pantryItemDuplicate', () => ({
  isPantryItemDuplicateError: jest.fn(() => false),
  getPantryItemDuplicateInfo: jest.fn(() => null),
  getPantryItemDuplicateInfoFromPayload: jest.fn(() => null),
  promptPantryDuplicate: jest.fn(),
}));

jest.mock('../utils', () => ({
  addToPantryItemsCache: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  ...jest.requireActual('#/utils/compilerSafeWrappers'),
  executeCacheUpdate: jest.fn((fn: () => void) => {
    try {
      fn();
    } catch {
      // swallow
    }
  }),
  executeMutation: jest.fn(async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch {
      return false;
    }
  }),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// Shape of the mutation variables the tests assert on. The recorded `fired`
// payload is `Record<string, unknown>`; this models the fields the assertions
// read off `input` so they can be accessed without `any`.
type FiredCreateVars = {
  input: {
    pantryId?: string;
    quantity?: number;
    itemId?: string;
    unit?: { unitId?: string; unitSymbol?: string };
    item?: { name?: string; brand?: string; category?: string };
    storage?: {
      storageState?: string;
      condition?: string;
      storageLocationId?: string;
      storageLocationName?: string;
    };
    thresholds?: { minQuantity?: number; restockQuantity?: number };
    netWeight?: { netWeight?: number; netWeightUnitId?: string };
  };
};

// The tests pass opaque `storageState` strings (e.g. 'PANTRY', 'REFRIGERATOR')
// to assert they round-trip through the mutation input untouched, so the
// fixture's `storageState` is widened to `string` and the assembled value is
// cast to the real `FormDataInput` at the call boundary.
type FormInputFixture = Omit<FormDataInput, 'storageState'> & {
  storageState: string;
};

const createFormInput = (
  overrides: Partial<FormInputFixture> = {},
): FormDataInput =>
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
  } as FormInputFixture as FormDataInput);

function createMock(success = true) {
  if (success) {
    return recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: {
            __typename: 'PantryItem',
            id: 'new-item',
            pantryId: 'pantry-1',
            itemId: null,
            itemName: 'Milk',
            quantity: '2',
            version: 1,
            updatedAt: '2026-01-01T00:00:00.000Z',
            storageState: 'PANTRY',
            expiresAt: null,
            lowStockAlert: false,
            isLowStock: false,
            minQuantity: null,
            lastUsedAt: null,
            netWeight: null,
            remainingNetWeight: null,
            activeBatchCount: 0,
            earliestBatchExpiration: null,
            item: null,
            unit: null,
            netWeightUnit: null,
            storageLocation: null,
            packageBreakdown: null,
            quantityBreakdown: null,
            pantry: {
              __typename: 'Pantry',
              id: 'pantry-1',
              stats: {
                __typename: 'PantryStats',
                totalItems: 1,
              },
            },
          },
        },
      },
    });
  }
  return recordMock(CreatePantryItemDocument, {
    data: {
      createPantryItem: {
        __typename: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        field: 'itemName',
      },
    },
  });
}

describe('useCreatePantryItem', () => {
  it('returns createPantryItem function', () => {
    const { result } = renderHookWithApollo(() =>
      useCreatePantryItem({ pantryId: 'pantry-1' }),
    );

    expect(typeof result.current.createPantryItem).toBe('function');
  });

  it('shows alert and returns false when itemName is empty', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter an item name',
    );
    expect(m.fired).toEqual([]);
  });

  it('returns true and calls onSuccess on successful creation', async () => {
    const onSuccess = jest.fn();
    const m = createMock();

    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1', onSuccess }),
      { operationMocks: [m.mock] },
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
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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

    const input = (m.fired[0] as FiredCreateVars).input;
    expect(input.pantryId).toBe('pantry-1');
    expect(input.quantity).toBe(12);
    expect(input.unit).toEqual({ unitId: 'unit-ea' });
    expect(input.item?.name).toBe('Eggs');
    expect(input.item?.brand).toBe('Free Range');
    expect(input.item?.category).toBe('Dairy');
    expect(input.storage?.storageState).toBe('REFRIGERATOR');
  });

  it('sends itemId for existing catalog item', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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

    const input = (m.fired[0] as FiredCreateVars).input;
    expect(input.itemId).toBe('catalog-item-1');
    expect(input.item).toBeUndefined();
  });

  it('uses selectedLocationId for storageLocationId', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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

    const storage = (m.fired[0] as FiredCreateVars).input.storage;
    expect(storage?.storageLocationId).toBe('loc-1');
    expect(storage?.storageLocationName).toBeUndefined();
  });

  it('uses storageLocationName when no selectedLocationId', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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

    const storage = (m.fired[0] as FiredCreateVars).input.storage;
    expect(storage?.storageLocationName).toBe('Top Shelf');
  });

  it('uses selectedCategoryId over inline category text', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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

    const item = (m.fired[0] as FiredCreateVars).input.item;
    expect(item?.category).toBe('cat-1');
  });

  it('includes thresholds when minQuantity or restockQuantity provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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

    const input = (m.fired[0] as FiredCreateVars).input;
    expect(input.thresholds).toEqual({ minQuantity: 2, restockQuantity: 5 });
  });

  it('includes netWeight when provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({
          netWeight: '500',
          netWeightUnitId: 'unit-g',
        }),
        pantryId: 'pantry-1',
        quantityValue: 1,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    const input = (m.fired[0] as FiredCreateVars).input;
    expect(input.netWeight).toEqual({
      netWeight: 500,
      netWeightUnitId: 'unit-g',
    });
  });

  it('returns false on failed creation with no success and no error', async () => {
    const m = createMock(false);
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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
  });

  it('sends storage.condition on create (full-screen add path)', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.createPantryItem({
        input: createFormInput({ condition: ItemCondition.Spoiled }),
        pantryId: 'pantry-1',
        quantityValue: 1,
        unitId: null,
        selectedLocationId: null,
        selectedCategoryId: null,
      });
    });

    const storage = (m.fired[0] as FiredCreateVars).input.storage;
    expect(storage?.condition).toBe('SPOILED');
  });

  it('prompts restock when the server returns a DuplicatePantryItemError union payload', async () => {
    (getPantryItemDuplicateInfoFromPayload as jest.Mock).mockReturnValueOnce({
      existingPantryItemId: 'existing-1',
      existingPantryItemIds: ['existing-1'],
    });
    // Resolve the recovery prompt immediately so the awaited call settles.
    (promptPantryDuplicate as jest.Mock).mockImplementationOnce(
      ({ onCancel }: { onCancel?: () => void }) => onCancel?.(),
    );

    const m = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'DuplicatePantryItemError',
          code: 'PANTRY_ITEM_ALREADY_EXISTS',
          message: 'Already in your pantry',
          existingPantryItemIds: ['existing-1'],
          suggestion: 'RESTOCK_EXISTING',
        },
      },
    });

    const { result } = renderHookWithApollo(
      () => useCreatePantryItem({ pantryId: 'pantry-1' }),
      { operationMocks: [m.mock] },
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

    expect(getPantryItemDuplicateInfoFromPayload).toHaveBeenCalled();
    expect(promptPantryDuplicate).toHaveBeenCalled();
    // onCancel resolves the recovery promise to false.
    expect(success!).toBe(false);
  });
});
