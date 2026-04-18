'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { usePantryItemSubmission } from '../usePantryItemSubmission';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockCreatePantryItem = jest.fn();
const mockRestockPantryItem = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useCreatePantryItemMutation: () => [mockCreatePantryItem, { loading: false }],
  useRestockPantryItemMutation: () => [mockRestockPantryItem, {}],
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: jest.fn((input: string) => {
    const num = parseFloat(input);
    return isNaN(num) ? null : num;
  }),
}));

jest.mock('#/utils/errors/pantryItemDuplicate', () => ({
  isPantryItemDuplicateError: jest.fn().mockReturnValue(false),
  getPantryItemDuplicateInfo: jest.fn().mockReturnValue(null),
}));

jest.mock('#/utils/compilerSafeWrappers');

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
  storageState: 'FRESH' as any,
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
  tags: '',
  brand: '',
  minQuantity: '',
  restockQuantity: '',
  onSuccess: mockOnSuccess,
  handlePageChange: mockHandlePageChange,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePantryItemSubmission', () => {
  it('returns handleConfirm and loading', () => {
    const { result } = renderHook(() => usePantryItemSubmission(defaultParams));

    expect(typeof result.current.handleConfirm).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('shows error and navigates to page 0 when itemName is empty', async () => {
    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, itemName: '  ' }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter an item name',
    );
    expect(mockHandlePageChange).toHaveBeenCalledWith(0);
  });

  it('shows error when quantity is invalid', async () => {
    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, quantityInput: 'abc' }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a valid quantity',
    );
    expect(mockHandlePageChange).toHaveBeenCalledWith(1);
  });

  it('shows error when quantity is zero', async () => {
    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, quantityInput: '0' }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a valid quantity',
    );
  });

  it('does nothing when pantryId is undefined', async () => {
    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, pantryId: undefined }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).not.toHaveBeenCalled();
  });

  it('calls createPantryItem with correct input on success', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() => usePantryItemSubmission(defaultParams));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          pantryId: 'pantry-1',
          quantity: 2,
          item: expect.objectContaining({ name: 'Milk' }),
        }),
      },
    });
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('includes tags when provided', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, tags: 'dairy, organic' }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          tags: ['dairy', 'organic'],
        }),
      },
    });
  });

  it('includes thresholds when minQuantity provided', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({
        ...defaultParams,
        minQuantity: '1',
        restockQuantity: '5',
      }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          thresholds: { minQuantity: 1, restockQuantity: 5 },
        }),
      },
    });
  });

  it('shows error alert when mutation fails', async () => {
    mockCreatePantryItem.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePantryItemSubmission(defaultParams));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to add item. Please try again.',
    );
  });

  it('includes expiration date when set', async () => {
    const date = new Date('2025-06-15T00:00:00.000Z');
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, expirationDate: date }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          expiresAt: '2025-06-15',
        }),
      },
    });
  });

  it('includes brand when provided', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, brand: 'Organic Valley' }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          item: expect.objectContaining({ brand: 'Organic Valley' }),
        }),
      },
    });
  });

  it('includes storage location when selectedStorageLocationId is set', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({
        ...defaultParams,
        selectedStorageLocationId: 'loc-1',
      }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          storage: expect.objectContaining({ storageLocationId: 'loc-1' }),
        }),
      },
    });
  });

  it('includes storageLocation name when no selectedStorageLocationId', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({
        ...defaultParams,
        storageLocation: 'Top Shelf',
      }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          storage: expect.objectContaining({
            storageLocationName: 'Top Shelf',
          }),
        }),
      },
    });
  });

  it('includes storageNotes when provided', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, storageNotes: 'Keep cool' }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          storage: expect.objectContaining({ storageNotes: 'Keep cool' }),
        }),
      },
    });
  });

  it('handles package details with valid packageSize and contentUnit', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({
        ...defaultParams,
        showPackageDetails: true,
        packageSize: '12',
        contentUnit: 'oz',
        contentUnitId: 'cu-1',
      }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          item: expect.objectContaining({
            units: expect.arrayContaining([
              expect.objectContaining({ packageSize: 12 }),
            ]),
          }),
        }),
      },
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

    mockCreatePantryItem.mockResolvedValue({
      data: null,
      error: { message: 'Duplicate item' },
    });

    const { result } = renderHook(() => usePantryItemSubmission(defaultParams));

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

    mockCreatePantryItem.mockResolvedValue({
      data: null,
      error: { message: 'Some error' },
    });

    const { result } = renderHook(() => usePantryItemSubmission(defaultParams));

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to add item. Please try again.',
    );
  });

  it('includes net weight when packageDetails and itemNetWeight provided', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({
        ...defaultParams,
        showPackageDetails: true,
        packageSize: '6',
        contentUnit: 'oz',
        contentUnitId: 'cu-1',
        itemNetWeight: '16',
        weightUnitId: 'wu-1',
      }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          item: expect.objectContaining({
            netWeight: 16,
            displayUnitId: 'wu-1',
          }),
        }),
      },
    });
  });

  it('uses pantryNetWeight when explicitly provided', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({
        ...defaultParams,
        pantryNetWeight: '500',
        pantryNetWeightUnitId: 'g-unit',
      }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          netWeight: expect.objectContaining({
            netWeight: 500,
            netWeightUnitId: 'g-unit',
          }),
        }),
      },
    });
  });

  it('omits unit from input when no unitId and no unit name', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() =>
      usePantryItemSubmission({ ...defaultParams, unit: '', unitId: null }),
    );

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(mockCreatePantryItem).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          unit: undefined,
        }),
      },
    });
  });
});
