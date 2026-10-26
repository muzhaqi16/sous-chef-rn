'use no memo';

import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { ErrorCode, StorageState } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { addPantryItemDefaults } from '#features/pantry/components/modals/AddToPantrySheet/addPantryItemFormConfig';
import { usePantryItemSubmission } from '../usePantryItemSubmission';
import type { AddPantryItemFormData } from '#features/pantry/types';

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: jest.fn((input: string) => {
    const num = parseFloat(input);
    return isNaN(num) ? null : num;
  }),
}));

const mockOnSuccess = jest.fn();

const defaultValues: AddPantryItemFormData = {
  ...addPantryItemDefaults('Milk'),
  quantityInput: '2',
  unit: 'cups',
  unitId: 'unit-1',
  storageState: StorageState.Refrigerated,
};

/** The hook as the sheet drives it: the form's values reach `handleConfirm`. */
function useSubmission(
  overrides: Partial<AddPantryItemFormData> & { pantryId?: string },
) {
  const { pantryId, ...values } = { pantryId: 'pantry-1', ...overrides };
  const submission = usePantryItemSubmission({
    pantryId,
    onSuccess: mockOnSuccess,
  });
  return {
    loading: submission.loading,
    handleConfirm: () =>
      submission.handleConfirm({ ...defaultValues, ...values }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

function createMock(success = true) {
  if (success) {
    return recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: {
            __typename: 'PantryItem',
            id: 'new-1',
            pantryId: 'pantry-1',
            itemId: null,
            itemName: 'Milk',
            quantity: 1,
            version: 1,
            updatedAt: '2026-01-01',
            storageState: StorageState.Ambient,
            expiresOn: null,
            lowStockAlert: false,
            isLowStock: false,
            minQuantity: null,
            lastUsedAt: null,
            netWeight: null,
            remainingNetWeight: null,
            activeBatchCount: 0,
            earliestBatchExpiresOn: null,
            item: null,
            unit: null,
            netWeightUnit: null,
            storageLocation: null,
            packageBreakdown: null,
            quantityBreakdown: null,
          },
          pantry: {
            __typename: 'Pantry',
            id: 'pantry-1',
            stats: { __typename: 'PantryStats', totalItems: 1 },
          },
        },
      },
    });
  }
  return recordMock(CreatePantryItemDocument, {
    data: {
      createPantryItem: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'Validation failed',
        field: 'itemName',
      },
    },
  });
}

function createErrorMock() {
  return recordMock(CreatePantryItemDocument, {
    error: new Error('Network error'),
  });
}

/**
 * Validation is NOT here. It moved to `addPantryItemSchema`, which reports on
 * the field instead of through an alert, and `handleSubmit` gates this hook on
 * it — so `handleConfirm` only ever runs against a valid form. The rules are
 * covered in `addPantryItemFormConfig.test.ts`.
 */
describe('usePantryItemSubmission', () => {
  it('returns handleConfirm and loading', () => {
    const { result } = renderHookWithApollo(() => useSubmission({}));

    expect(typeof result.current.handleConfirm).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('does nothing when pantryId is undefined', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useSubmission({ pantryId: undefined }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toEqual([]);
  });

  it('calls createPantryItem with correct input on success', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(() => useSubmission({}), {
      operationMocks: [m.mock],
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        pantryId: 'pantry-1',
        quantity: 2,
        item: { inline: expect.objectContaining({ name: 'Milk' }) },
      }),
    });
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('includes tags when provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useSubmission({ tags: 'dairy, organic' }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        tags: ['dairy', 'organic'],
      }),
    });
  });

  it('includes thresholds when minQuantity provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        useSubmission({
          minQuantity: '1',
          restockQuantity: '5',
        }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        thresholds: { minQuantity: 1, restockQuantity: 5 },
      }),
    });
  });

  it('shows error alert when mutation fails', async () => {
    const { result } = renderHookWithApollo(() => useSubmission({}), {
      operationMocks: [createErrorMock().mock],
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to add item',
    );
  });

  it('includes expiration date when set', async () => {
    const date = new Date(2025, 5, 15);
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useSubmission({ expirationDate: date }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    // The picked LOCAL day, whatever the device's offset from UTC.
    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        expiresOn: '2025-06-15',
      }),
    });
  });

  it('includes brand when provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useSubmission({ brand: 'Organic Valley' }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        item: {
          inline: expect.objectContaining({ brand: 'Organic Valley' }),
        },
      }),
    });
  });

  it('includes storage location when selectedStorageLocationId is set', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        useSubmission({
          selectedStorageLocationId: 'loc-1',
        }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        storage: expect.objectContaining({ location: { id: 'loc-1' } }),
      }),
    });
  });

  it('includes storageLocation name when no selectedStorageLocationId', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        useSubmission({
          storageLocation: 'Top Shelf',
        }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        storage: expect.objectContaining({
          location: { name: 'Top Shelf' },
        }),
      }),
    });
  });

  it('includes storageNotes when provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        useSubmission({
          storageNotes: 'Keep cool',
        }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        storage: expect.objectContaining({ storageNotes: 'Keep cool' }),
      }),
    });
  });

  it('handles package details with valid packageSize and contentUnit', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        useSubmission({
          showPackageDetails: true,
          packageSize: '12',
          contentUnit: 'oz',
          contentUnitId: 'cu-1',
        }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        item: {
          inline: expect.objectContaining({
            units: expect.arrayContaining([
              expect.objectContaining({ packageSize: 12 }),
            ]),
          }),
        },
      }),
    });
  });

  it('shows an error alert when the create fails', async () => {
    const { result } = renderHookWithApollo(() => useSubmission({}), {
      operationMocks: [createErrorMock().mock],
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to add item',
    );
  });

  it('includes net weight when packageDetails and itemNetWeight provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        useSubmission({
          showPackageDetails: true,
          packageSize: '6',
          contentUnit: 'oz',
          contentUnitId: 'cu-1',
          itemNetWeight: '16',
          weightUnitId: 'wu-1',
        }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        item: {
          inline: expect.objectContaining({
            netWeight: 16,
            displayUnitId: 'wu-1',
          }),
        },
      }),
    });
  });

  it('uses pantryNetWeight when explicitly provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        useSubmission({
          pantryNetWeight: '500',
          pantryNetWeightUnitId: 'g-unit',
        }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        netWeight: expect.objectContaining({
          netWeight: 500,
          netWeightUnitId: 'g-unit',
        }),
      }),
    });
  });

  it('omits unit from input when no unitId and no unit name', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => useSubmission({ unit: '', unitId: null }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        unit: undefined,
      }),
    });
  });

  describe('a product the pantry already holds', () => {
    // Args are load-bearing — see the reader's own suite: the connection is
    // keyed on them, so a seed without them writes a key the app never has.
    const STOCKED_PANTRY = gql`
      query SeedStockedPantry(
        $id: ID!
        $itemsFirst: Int
        $itemsFilter: PantryItemFilters
        $itemsOrderBy: PantryItemOrderBy
      ) {
        pantry(id: $id) {
          __typename
          id
          itemsConnection(
            first: $itemsFirst
            filters: $itemsFilter
            orderBy: $itemsOrderBy
          ) {
            __typename
            totalCount
            edges {
              __typename
              cursor
              node {
                __typename
                id
                itemName
                quantity
                item {
                  __typename
                  id
                }
                unit {
                  __typename
                  id
                }
              }
            }
          }
        }
      }
    `;

    const seedStocked = (itemName: string, unitId = 'unit-1') => {
      const cache = makeCache();
      cache.writeQuery({
        query: STOCKED_PANTRY,
        variables: {
          id: 'pantry-1',
          itemsFirst: 100,
          itemsFilter: undefined,
          itemsOrderBy: undefined,
        },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'pantry-1',
            itemsConnection: {
              __typename: 'PantryItemConnection',
              totalCount: 1,
              edges: [
                {
                  __typename: 'PantryItemEdge',
                  cursor: 'pi-1',
                  node: {
                    __typename: 'PantryItem',
                    id: 'pi-1',
                    itemName,
                    quantity: 3,
                    item: { __typename: 'Item', id: 'item-1' },
                    unit: { __typename: 'Unit', id: unitId },
                  },
                },
              ],
            },
          },
        },
      });
      return cache;
    };

    // USM-2: an add of a held product joins its stack, or stands apart from
    // it, on the server; the form asks nothing and never restocks itself.
    it.each([
      ['in the same unit', '  MILK ', 'unit-1'],
      ['in another unit', 'Milk', 'unit-2'],
    ])('goes as a forced add %s, with no prompt', async (_l, name, unitId) => {
      const m = createMock();
      const { result } = renderHookWithApollo(() => useSubmission({}), {
        cache: seedStocked(name, unitId),
        operationMocks: [m.mock],
      });

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(alertService.alert).not.toHaveBeenCalled();
      expect(m.fired).toHaveLength(1);
      expect(m.fired[0]).toMatchObject({ input: { forceAdd: true } });
    });
  });
});
