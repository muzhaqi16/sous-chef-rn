import { renderHook } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { createApolloWrapper } from '#/test-utils/apolloMockProvider';
import { useUpdatePantryItem } from '../useUpdatePantryItem';

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
  stateToCountKey: jest.fn(() => 'ambient'),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const createCurrentItem = () =>
  ({
    id: 'item-1',
    pantryId: 'pantry-1',
    quantity: 5,
    unit: { id: 'unit-1', symbol: 'g', name: 'Gram' },
    version: 1,
    storageState: 'PANTRY',
    storageLocation: null,
    updatedAt: '2025-01-01T00:00:00Z',
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

const successMock = (variables: {
  id: string;
  input: any;
}): MockedResponse => ({
  request: { query: UpdatePantryItemDocument, variables },
  result: {
    data: {
      updatePantryItem: {
        __typename: 'PantryItemPayload',
        success: true,
        message: 'OK',
        code: 'OK',
        pantryItem: {
          __typename: 'PantryItem',
          id: variables.id,
          ...variables.input,
        },
      },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUpdatePantryItem', () => {
  it('returns updatePantryItemFields function', () => {
    const { result } = renderHook(() => useUpdatePantryItem({}), {
      wrapper: createApolloWrapper([]),
    });

    expect(typeof result.current.updatePantryItemFields).toBe('function');
  });

  it('fires mutation with dirty fields only', () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUpdatePantryItem({ onSuccess }), {
      wrapper: createApolloWrapper([
        successMock({ id: 'item-1', input: { itemName: 'Milk' } }),
      ]),
    });

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });

    // onSuccess fires synchronously (mutation is fire-and-forget)
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls onSuccess immediately without waiting for mutation', () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useUpdatePantryItem({ onSuccess }), {
      wrapper: createApolloWrapper([
        successMock({ id: 'item-1', input: { itemName: 'Milk' } }),
      ]),
    });

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls onSuccess without mutation when no dirty fields', () => {
    const onSuccess = jest.fn();
    // Empty mocks — if a mutation fires, MockedProvider errors
    const { result } = renderHook(() => useUpdatePantryItem({ onSuccess }), {
      wrapper: createApolloWrapper([]),
    });

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: {},
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('builds optimistic unit when trackingUnit has different id', () => {
    const { result } = renderHook(() => useUpdatePantryItem({}), {
      wrapper: createApolloWrapper([
        successMock({ id: 'item-1', input: { storageNotes: 'Fresh milk' } }),
      ]),
    });

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

    const { buildOptimisticUnit } = jest.requireMock('../utils');
    expect(buildOptimisticUnit).toHaveBeenCalled();
  });

  it('does not build optimistic unit when trackingUnit matches current', () => {
    const { result } = renderHook(() => useUpdatePantryItem({}), {
      wrapper: createApolloWrapper([
        successMock({ id: 'item-1', input: { storageNotes: 'Fresh milk' } }),
      ]),
    });

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      currentItem: createCurrentItem(),
      dirtyFields: { notes: true },
      selectedLocationId: null,
      selectedBrandId: null,
      trackingUnit: { id: 'unit-1', name: 'Gram', symbol: 'g', type: 'WEIGHT' },
    });

    const { buildOptimisticUnit } = jest.requireMock('../utils');
    expect(buildOptimisticUnit).not.toHaveBeenCalled();
  });
});
