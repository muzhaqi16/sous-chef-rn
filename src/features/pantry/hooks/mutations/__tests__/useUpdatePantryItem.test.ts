import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { StorageState, UnitType } from '#/graphql/generated/schemaTypes';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UseUpdatePantryItem_PantryItemFragmentDoc } from '../useUpdatePantryItem.generated';
import type { DirtyFieldFlags, FormDataInput } from '../types';
import { useUpdatePantryItem } from '../useUpdatePantryItem';

jest.mock('#/services/errorService');

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
    (data: FormDataInput, dirtyFields: DirtyFieldFlags) => {
      const input: Record<string, unknown> = {};
      if (dirtyFields.itemName) input.itemName = data.itemName;
      if (dirtyFields.notes) input.storageNotes = data.notes;
      return input;
    },
  ),
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
  heldQuantity: 5,
  displayAmount: {
    __typename: 'DisplayAmount',
    quantity: 5,
    unit: { __typename: 'Unit', id: 'unit-1', symbol: 'g' },
  },
  version: 1,
  updatedAt: '2025-01-01',
  storageState: 'PANTRY',
  condition: 'GOOD',
  expiresOn: null,
  lowStockAlert: false,
  isLowStock: false,
  minQuantity: null,
  lastUsedAt: null,
  netWeight: null,
  remainingNetWeight: null,
  activeBatchCount: 0,
  earliestBatchExpiresOn: null,
  restockQuantity: null,
  storageNotes: null,
  tags: [],
  item: null,
  unit: {
    __typename: 'Unit',
    id: 'unit-1',
    name: 'Gram',
    symbol: 'g',
    type: UnitType.Weight,
    displayAsFraction: false,
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

  it('resolves true once the write is queued', async () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
      operationMocks: [
        {
          request: { query: UpdatePantryItemDocument, variables: () => true },
          result: { data: { updatePantryItem: null } },
        },
      ],
    });

    const stands = await result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(stands).toBe(true);
  });

  it('resolves false when the server refuses the write', async () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
      operationMocks: [
        {
          request: { query: UpdatePantryItemDocument, variables: () => true },
          result: {
            data: {
              updatePantryItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'Name is invalid',
                field: 'itemName',
              },
            },
          },
        },
      ],
    });

    const stands = await result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(stands).toBe(false);
  });

  it('resolves true without a mutation when no fields are dirty', async () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
    });

    const stands = await result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData(),
      dirtyFields: {},
      selectedLocationId: null,
      selectedBrandId: null,
    });

    expect(stands).toBe(true);
    // Early return — buildDirtyUpdateInput returns {} so the mutation never fires.
    const { buildDirtyUpdateInput } = jest.requireMock('../utils');
    expect(buildDirtyUpdateInput.mock.results[0]?.value).toEqual({});
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
    void result.current.updatePantryItemFields({
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
                code: 'VALIDATION_FAILED',
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
    // A refused union payload resolves as data, so the mutation's onError
    // never fires — the hook has to tell the user itself. The refusal names a
    // field, so its own sentence is what gets shown.
    const { alertService } = require('#/services/alertService');
    // The app's copy for `field: 'itemName'`, not the server's "Name is
    // invalid" — the server has no locale to render that in.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Enter a name for this item.',
    );
  });

  it('falls back to the generic copy for an unattributed refusal', async () => {
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
                code: 'VALIDATION_FAILED',
                message: 'Something was invalid',
                field: null,
              },
            },
          },
        },
      ],
    });

    await act(async () => {
      fireRename(result, 'Bad Name');
    });

    await waitFor(() => {
      expect(readItemName(cache)).toBe('Milk');
    });
    const { alertService } = require('#/services/alertService');
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to update item',
    );
  });

  it('tells the user which input the server refused (the unit)', async () => {
    // `unit` only relabels the unit in use; a different one is refused on
    // `field: "unit"`. The edit must snap back AND say which input was refused —
    // in the app's own words, because `message` is English only.
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
                code: 'VALIDATION_FAILED',
                message:
                  "A pantry item's unit changes through changePantryItemUnit.",
                field: 'unit',
              },
            },
          },
        },
      ],
    });

    await act(async () => {
      fireRename(result, 'Milk (cans)');
    });

    await waitFor(() => {
      expect(readItemName(cache)).toBe('Milk');
    });
    const { alertService } = require('#/services/alertService');
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      "This item's unit changes through the Unit field, which shows what happens to its stock before saving.",
    );
  });
});
