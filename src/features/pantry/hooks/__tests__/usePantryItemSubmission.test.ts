'use no memo';

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  StorageState,
  ItemCondition,
  AcquisitionMethod,
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

jest.mock('#/utils/errors/pantryItemDuplicate', () => {
  const actual = jest.requireActual('#/utils/errors/pantryItemDuplicate');
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
            quantity: '1',
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
    const date = new Date('2025-06-15T00:00:00.000Z');
    const m = createMock();
    const { result } = renderHookWithApollo(
      () => usePantryItemSubmission({ ...defaultParams, expirationDate: date }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    // Full ISO DateTime — the schema scalar is DateTime; a date-only string
    // relied on unspecified server coercion.
    expect(m.fired).toContainEqual({
      input: expect.objectContaining({
        expiresAt: '2025-06-15T00:00:00.000Z',
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
    } = require('#/utils/errors/pantryItemDuplicate');
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

  it('shows error when result has error but is not duplicate', async () => {
    const {
      isPantryItemDuplicateError,
    } = require('#/utils/errors/pantryItemDuplicate');
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
      input: expect.objectContaining({
        unit: undefined,
      }),
    });
  });
});
