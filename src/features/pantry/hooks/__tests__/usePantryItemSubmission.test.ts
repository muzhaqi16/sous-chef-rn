'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  AcquisitionMethod,
  ErrorCode,
  ItemCondition,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { usePantryItemSubmission } from '../usePantryItemSubmission';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

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

jest.mock('#domain/pantryItemDuplicate', () => {
  const actual = jest.requireActual('#domain/pantryItemDuplicate');
  const isDup = jest.fn().mockReturnValue(false);
  const getInfo = jest.fn().mockReturnValue(null);
  return {
    // Keep the real `promptPantryDuplicate` so it calls the (mocked)
    // alertService with the standard duplicate copy the tests assert on; only
    // the detection helpers are stubbed per-test.
    ...actual,
    isPantryItemDuplicateError: isDup,
    getPantryItemDuplicateInfo: getInfo,
    // Delegates to the stubbed detectors (mirrors the real impl) so the
    // per-test override of isPantryItemDuplicateError still drives handling.
    getPantryItemDuplicateFromResult: jest.fn(
      (payload: { __typename?: string } | null | undefined, error: unknown) => {
        if (payload?.__typename === 'DuplicatePantryItemError') {
          const info = actual.getPantryItemDuplicateInfoFromPayload(payload);
          if (info) return info;
        }
        if (error != null && isDup(error)) return getInfo(error);
        return null;
      },
    ),
  };
});

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockOnSuccess = jest.fn();
const mockHandlePageChange = jest.fn();

const defaultParams = {
  pantryId: 'pantry-1',
  itemName: 'Milk',
  quantityInput: '2',
  unit: 'cups',
  unitId: 'unit-1',
  storageState: StorageState.Refrigerated,
  showPackageDetails: false,
  packageSize: '',
  contentUnit: '',
  contentUnitId: null,
  itemNetWeight: '',
  weightUnitId: null,
  pantryNetWeight: '',
  pantryNetWeightUnitId: null,
  expirationDate: null,
  selectedStorageLocationId: null,
  storageLocation: '',
  storageNotes: '',
  condition: ItemCondition.Good,
  tags: '',
  brand: '',
  category: '',
  minQuantity: '',
  restockQuantity: '',
  storeId: null,
  costPerUnit: '',
  acquisitionMethod: AcquisitionMethod.Purchased,
  onSuccess: mockOnSuccess,
  handlePageChange: mockHandlePageChange,
};

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
    const { result } = renderHookWithApollo(() =>
      usePantryItemSubmission(defaultParams),
    );

    expect(typeof result.current.handleConfirm).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('does nothing when pantryId is undefined', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => usePantryItemSubmission({ ...defaultParams, pantryId: undefined }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toEqual([]);
  });

  it('calls createPantryItem with correct input on success', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => usePantryItemSubmission(defaultParams),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        pantryId: 'pantry-1',
        quantity: 2,
        item: expect.objectContaining({ name: 'Milk' }),
      }),
    });
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('includes tags when provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        usePantryItemSubmission({ ...defaultParams, tags: 'dairy, organic' }),
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
        usePantryItemSubmission({
          ...defaultParams,
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
    const { result } = renderHookWithApollo(
      () => usePantryItemSubmission(defaultParams),
      { operationMocks: [createErrorMock().mock] },
    );

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
      () => usePantryItemSubmission({ ...defaultParams, expirationDate: date }),
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
      () =>
        usePantryItemSubmission({ ...defaultParams, brand: 'Organic Valley' }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: expect.objectContaining({
        item: expect.objectContaining({ brand: 'Organic Valley' }),
      }),
    });
  });

  it('includes storage location when selectedStorageLocationId is set', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        usePantryItemSubmission({
          ...defaultParams,
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
        storage: expect.objectContaining({ storageLocationId: 'loc-1' }),
      }),
    });
  });

  it('includes storageLocation name when no selectedStorageLocationId', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        usePantryItemSubmission({
          ...defaultParams,
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
          storageLocationName: 'Top Shelf',
        }),
      }),
    });
  });

  it('includes storageNotes when provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        usePantryItemSubmission({
          ...defaultParams,
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
        usePantryItemSubmission({
          ...defaultParams,
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
        item: expect.objectContaining({
          units: expect.arrayContaining([
            expect.objectContaining({ packageSize: 12 }),
          ]),
        }),
      }),
    });
  });

  it('handles duplicate pantry item error with restock option', async () => {
    const {
      isPantryItemDuplicateError,
      getPantryItemDuplicateInfo,
    } = require('#domain/pantryItemDuplicate');
    isPantryItemDuplicateError.mockReturnValue(true);
    getPantryItemDuplicateInfo.mockReturnValue({
      existingPantryItemId: 'existing-1',
    });

    const { result } = renderHookWithApollo(
      () => usePantryItemSubmission(defaultParams),
      { operationMocks: [createErrorMock().mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Item Already in Pantry',
      expect.stringContaining('already in your pantry'),
      expect.any(Array),
    );
  });

  it('recovers a server duplicate refusal by restocking the named stack, never a second create', async () => {
    // A forced add would land on this same stack while the row published under
    // the minted id stayed behind as a ghost; restock is the only recovery.
    const refused = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'DuplicatePantryItemError',
          code: ErrorCode.Conflict,
          message: 'Already in pantry',
          existingPantryItemIds: ['existing-1'],
        },
      },
    });
    const restock = recordMock(RestockPantryItemDocument, {
      data: {
        restockPantryItem: { __typename: 'RestockPantryItemPayload' },
      },
    });

    const { result } = renderHookWithApollo(
      () => usePantryItemSubmission(defaultParams),
      { operationMocks: [refused.mock, restock.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    const buttons = (alertService.alert as jest.Mock).mock.lastCall?.[2] as {
      text: string;
      onPress?: () => void;
    }[];
    expect(buttons.map(b => b.text)).toEqual(['Cancel', 'Restock']);

    await act(async () => {
      buttons[1]?.onPress?.();
    });

    await waitFor(() =>
      expect(restock.fired).toContainEqual({
        input: expect.objectContaining({ id: 'existing-1', quantity: 2 }),
      }),
    );
    await waitFor(() => expect(mockOnSuccess).toHaveBeenCalled());
    expect(refused.fired).toHaveLength(1);
  });

  it('shows error when result has error but is not duplicate', async () => {
    const {
      isPantryItemDuplicateError,
    } = require('#domain/pantryItemDuplicate');
    isPantryItemDuplicateError.mockReturnValue(false);

    const { result } = renderHookWithApollo(
      () => usePantryItemSubmission(defaultParams),
      { operationMocks: [createErrorMock().mock] },
    );

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
        usePantryItemSubmission({
          ...defaultParams,
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
        item: expect.objectContaining({
          netWeight: 16,
          displayUnitId: 'wu-1',
        }),
      }),
    });
  });

  it('uses pantryNetWeight when explicitly provided', async () => {
    const m = createMock();
    const { result } = renderHookWithApollo(
      () =>
        usePantryItemSubmission({
          ...defaultParams,
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
      () =>
        usePantryItemSubmission({ ...defaultParams, unit: '', unitId: null }),
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

  /**
   * Offline-first: this form is reachable with no network, so a duplicate it
   * could have seen in its own cache must not become a create the server will
   * only refuse later. It sends an inline item with no catalog id, so the match
   * is on the name plus the unit — the server refuses only the item in that
   * unit — and it only ever prompts on that match, never acts.
   */
  describe('a duplicate the cache can already see', () => {
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

    it('prompts without firing a create', async () => {
      const m = createMock();
      const { result } = renderHookWithApollo(
        () => usePantryItemSubmission(defaultParams),
        { cache: seedStocked('  MILK '), operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Item Already in Pantry',
        expect.stringContaining('already in your pantry'),
        expect.any(Array),
      );
      expect(m.fired).toHaveLength(0);
    });

    it('still fires the create when the name is not stocked', async () => {
      const m = createMock();
      const { result } = renderHookWithApollo(
        () => usePantryItemSubmission(defaultParams),
        { cache: seedStocked('Oat Milk'), operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(m.fired).toHaveLength(1);
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('fires the create when the item is stocked only in another unit', async () => {
      // A different unit is a separate stack the server accepts.
      const m = createMock();
      const { result } = renderHookWithApollo(
        () => usePantryItemSubmission(defaultParams),
        { cache: seedStocked('Milk', 'unit-litre'), operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(alertService.alert).not.toHaveBeenCalled();
      expect(m.fired).toHaveLength(1);
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('offers the restock for a blank unit, which the server resolves to the held stack', async () => {
      const m = createMock();
      const { result } = renderHookWithApollo(
        () =>
          usePantryItemSubmission({
            ...defaultParams,
            itemName: 'Eggs',
            unit: '',
            unitId: null,
          }),
        {
          cache: seedStocked('Eggs', 'unit-piece'),
          operationMocks: [m.mock],
        },
      );

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Item Already in Pantry',
        expect.stringContaining('already in your pantry'),
        expect.any(Array),
      );
      expect(m.fired).toHaveLength(0);
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('leaves a free-text unit to the server', async () => {
      const m = createMock();
      const { result } = renderHookWithApollo(
        () =>
          usePantryItemSubmission({
            ...defaultParams,
            unit: 'cups',
            unitId: null,
          }),
        { cache: seedStocked('Milk'), operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.handleConfirm();
      });

      expect(alertService.alert).not.toHaveBeenCalled();
      expect(m.fired).toHaveLength(1);
    });
  });
});
