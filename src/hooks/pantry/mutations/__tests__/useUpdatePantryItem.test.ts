import { renderHook } from '@testing-library/react-native';
import { useUpdatePantryItem } from '../useUpdatePantryItem';

const mockUpdateMutation = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useUpdatePantryItemMutation: jest.fn(() => [mockUpdateMutation]),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Update error' })),
  }),
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Version conflict'),
}));

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  enhanceWithVersion: jest.fn((item, updates) => ({ ...item, ...updates })),
}));

jest.mock('#/apollo/utils/optimisticTypes', () => ({
  buildOptimisticMutationResponse: jest.fn(
    (mutationName, payloadTypeName, dataField, data) => ({
      __typename: 'Mutation',
      [mutationName]: {
        __typename: payloadTypeName,
        success: true,
        message: 'OK',
        code: 'OK',
        [dataField]: data,
      },
    }),
  ),
}));

jest.mock('../utils', () => ({
  buildDirtyUpdateInput: jest.fn((data: any, dirtyFields: any) => {
    const input: Record<string, any> = {};
    if (dirtyFields.itemName) input.itemName = data.itemName;
    if (dirtyFields.notes) input.storageNotes = data.notes;
    return input;
  }),
  buildOptimisticUnit: jest.fn(() => ({
    __typename: 'Unit',
    id: 'new-unit-id',
    symbol: 'kg',
    name: 'Kilogram',
  })),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMutation.mockResolvedValue({});
});

const createCurrentItem = () =>
  ({
    id: 'item-1',
    quantity: 5,
    unit: { id: 'unit-1', symbol: 'g', name: 'Gram' },
    version: 1,
  } as any);

const createFormData = (overrides: Record<string, any> = {}) =>
  ({
    itemName: 'Milk',
    storageState: 'PANTRY',
    location: '',
    notes: 'Fresh milk',
    category: '',
    unit: 'kg',
    ...overrides,
  } as any);

describe('useUpdatePantryItem', () => {
  it('returns updatePantryItemFields function', () => {
    const { result } = renderHook(() => useUpdatePantryItem({}));

    expect(typeof result.current.updatePantryItemFields).toBe('function');
  });

  it('fires mutation with dirty fields only', () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUpdatePantryItem({ onSuccess }));

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(mockUpdateMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          id: 'item-1',
          input: { itemName: 'Milk' },
        },
      }),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls onSuccess immediately without waiting for mutation', () => {
    const onSuccess = jest.fn();
    // Do not resolve the mutation promise yet
    mockUpdateMutation.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUpdatePantryItem({ onSuccess }));

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });

    // onSuccess is called synchronously, not waiting for mutation
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls onSuccess without mutation when no dirty fields', () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUpdatePantryItem({ onSuccess }));

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: {},
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(mockUpdateMutation).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('includes optimistic unit when trackingUnit has different id', () => {
    mockUpdateMutation.mockResolvedValue({});

    const { result } = renderHook(() => useUpdatePantryItem({}));

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: { notes: true },
      selectedLocationId: null,
      selectedBrandId: null,
      trackingUnit: {
        id: 'new-unit-id',
        name: 'Kilogram',
        symbol: 'kg',
        type: 'WEIGHT',
      },
    });

    // The optimisticResponse should be passed
    expect(mockUpdateMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        optimisticResponse: expect.any(Object),
      }),
    );
  });

  it('does not include optimistic unit when trackingUnit matches current', () => {
    mockUpdateMutation.mockResolvedValue({});

    const { result } = renderHook(() => useUpdatePantryItem({}));

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: { notes: true },
      selectedLocationId: null,
      selectedBrandId: null,
      trackingUnit: { id: 'unit-1', name: 'Gram', symbol: 'g', type: 'WEIGHT' },
    });

    // buildOptimisticUnit should not be called for same unit
    const { buildOptimisticUnit } = jest.requireMock('../utils');
    expect(buildOptimisticUnit).not.toHaveBeenCalled();
  });
});
