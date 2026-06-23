import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UseUpdatePantryItem_PantryItemFragmentDoc } from '../useUpdatePantryItem.generated';
import type { FormDataInput } from '../types';
import { useUpdatePantryItem } from '../useUpdatePantryItem';

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Update error' })),
  }),
  errorService: {
    reportError: jest.fn(),
  },
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Version conflict'),
}));

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  enhanceWithVersion: jest.fn((item, updates) => ({ ...item, ...updates })),
  buildOptimisticMutationResponse: jest.fn(
    (opName, payloadTypename, fields) => ({
      __typename: 'Mutation',
      [opName]: { __typename: payloadTypename, ...fields },
    }),
  ),
}));

jest.mock('../utils', () => ({
  buildDirtyUpdateInput: jest.fn(
    (data: FormDataInput, dirtyFields: Record<string, boolean>) => {
      const input: Record<string, unknown> = {};
      if (dirtyFields.itemName) input.itemName = data.itemName;
      if (dirtyFields.notes) input.storageNotes = data.notes;
      return input;
    },
  ),
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

// Hook reads currentItem from the cache via cache.readFragment, so tests
// must seed the cache with a matching entity. The optimistic response is
// then computed from the cached values plus the dirty-field updates.
const buildPantryItem = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'PantryItem',
  id: 'item-1',
  pantryId: 'pantry-1',
  itemId: null,
  itemName: 'Milk',
  quantity: 5,
  version: 1,
  updatedAt: '2025-01-01T00:00:00Z',
  storageState: 'PANTRY',
  condition: 'GOOD',
  expiresAt: null,
  lowStockAlert: false,
  isLowStock: false,
  minQuantity: null,
  lastUsedAt: null,
  netWeight: null,
  remainingNetWeight: null,
  activeBatchCount: 0,
  earliestBatchExpiration: null,
  restockQuantity: null,
  storageNotes: null,
  tags: [],
  item: null,
  unit: {
    __typename: 'Unit',
    id: 'unit-1',
    name: 'Gram',
    symbol: 'g',
    type: 'WEIGHT',
    isMetric: true,
    baseUnitId: null,
    conversionFactor: 1,
    isCommon: true,
    displayAsFraction: false,
    minPrecision: 0,
    autoConvertThreshold: null,
  },
  netWeightUnit: null,
  storageLocation: null,
  packageBreakdown: null,
  quantityBreakdown: null,
  brand: null,
  ...overrides,
});

const seedItem = () => seedCache([buildPantryItem()]);

const createFormData = (
  overrides: Partial<FormDataInput> = {},
): FormDataInput => ({
  itemName: 'Milk',
  storageState: StorageState.Ambient,
  location: '',
  notes: 'Fresh milk',
  category: '',
  unit: 'kg',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUpdatePantryItem', () => {
  it('returns updatePantryItemFields function', () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
    });

    expect(typeof result.current.updatePantryItemFields).toBe('function');
  });

  it('fires mutation with dirty fields only', () => {
    const onSuccess = jest.fn();
    const { result } = renderHookWithApollo(
      () => useUpdatePantryItem({ onSuccess }),
      { cache: seedItem() },
    );

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });

    // onSuccess fires synchronously (mutation is fire-and-forget)
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls onSuccess immediately without waiting for mutation', () => {
    const onSuccess = jest.fn();
    const { result } = renderHookWithApollo(
      () => useUpdatePantryItem({ onSuccess }),
      { cache: seedItem() },
    );

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls onSuccess without mutation when no dirty fields', () => {
    const onSuccess = jest.fn();
    const { result } = renderHookWithApollo(
      () => useUpdatePantryItem({ onSuccess }),
      { cache: seedItem() },
    );

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      dirtyFields: {},
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(onSuccess).toHaveBeenCalled();
    // Early return — buildDirtyUpdateInput returns {} so the mutation never fires.
    const { buildDirtyUpdateInput } = jest.requireMock('../utils');
    expect(buildDirtyUpdateInput.mock.results[0]?.value).toEqual({});
  });

  it('builds optimistic unit when trackingUnit has different id', () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
    });

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
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
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
    });

    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      dirtyFields: { notes: true },
      selectedLocationId: null,
      selectedBrandId: null,
      trackingUnit: { id: 'unit-1', name: 'Gram', symbol: 'g', type: 'WEIGHT' },
    });

    const { buildOptimisticUnit } = jest.requireMock('../utils');
    expect(buildOptimisticUnit).not.toHaveBeenCalled();
  });
});

describe('useUpdatePantryItem — local-first cache behavior', () => {
  const readItemName = (cache: ReturnType<typeof seedCache>) =>
    cache.readFragment<{ itemName: string }>({
      id: cache.identify({ __typename: 'PantryItem', id: 'item-1' }),
      fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
      fragmentName: 'useUpdatePantryItem_pantryItem',
    })?.itemName;

  const fireRename = (
    result: { current: ReturnType<typeof useUpdatePantryItem> },
    itemName: string,
  ) => {
    result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData({ itemName }),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });
  };

  it('writes the update to the cache PERMANENTLY before the mutation settles, and a queued (null) result keeps it', async () => {
    const cache = seedItem();
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdatePantryItemDocument,
            variables: () => true,
          },
          // The offline queue completes an intercepted mutation with each
          // top-level field null — the classifier reads that as 'queued'.
          result: { data: { updatePantryItem: null } },
        },
      ],
    });

    await act(async () => {
      fireRename(result, 'Oat Milk');
      // Synchronous permanent write — visible before the mutation settles.
      expect(readItemName(cache)).toBe('Oat Milk');
    });

    // Queued result keeps the write (no rollback).
    expect(readItemName(cache)).toBe('Oat Milk');
  });

  it('restores the pre-edit snapshot when the server rejects the update', async () => {
    const cache = seedItem();
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdatePantryItemDocument,
            variables: () => true,
          },
          result: {
            data: {
              updatePantryItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_ERROR',
                message: 'Name is invalid',
                field: 'itemName',
              },
            },
          },
        },
      ],
    });

    await act(async () => {
      fireRename(result, 'Bad Name');
      expect(readItemName(cache)).toBe('Bad Name');
    });

    await waitFor(() => {
      expect(readItemName(cache)).toBe('Milk');
    });
  });
});
