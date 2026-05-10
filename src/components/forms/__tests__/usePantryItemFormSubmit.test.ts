import { renderHook } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import {
  usePantryItemFormSubmit,
  type PantryItemFormData,
  type UsePantryItemFormSubmitParams,
} from '../usePantryItemFormSubmit';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutation: jest.fn(async (fn: any, onError: any) => {
    try {
      await fn();
      return true;
    } catch (e) {
      onError?.(e);
      return false;
    }
  }),
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: jest.fn((input: string) => {
    const n = parseFloat(input);
    return isNaN(n) || n <= 0 ? null : n;
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const baseData: PantryItemFormData = {
  itemName: 'Milk',
  quantityInput: '2',
  unit: 'L',
  storageState: 'AMBIENT',
  location: '',
  notes: '',
  category: '',
  brand: '',
  netWeight: '',
  netWeightUnit: '',
  netWeightUnitId: '',
};

function defaults(
  overrides: Partial<UsePantryItemFormSubmitParams> = {},
): UsePantryItemFormSubmitParams {
  return {
    mode: 'add',
    itemId: undefined,
    currentPantryId: 'pantry-1',
    isWeightLocked: false,
    existingItemData: null,
    dirtyFields: {},
    trackingUnit: { id: 'unit-1', name: 'Liter', symbol: 'L', type: null },
    netWeightUnitId: null,
    selectedLocationId: null,
    selectedBrandId: null,
    selectedCategoryId: null,
    selectedStorageLocation: null,
    createPantryItem: jest.fn().mockResolvedValue(undefined),
    updatePantryItemFields: jest.fn(),
    updateQuantity: jest.fn(),
    resolveUnitId: jest.fn(),
    onSuccess: jest.fn(),
    ...overrides,
  };
}

describe('usePantryItemFormSubmit', () => {
  describe('validation', () => {
    it('alerts when quantity is invalid', async () => {
      const params = defaults();
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave({ ...baseData, quantityInput: '' });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Please enter a valid quantity',
      );
      expect(params.createPantryItem).not.toHaveBeenCalled();
    });

    it('alerts when no pantry is selected', async () => {
      const params = defaults({ currentPantryId: null });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave(baseData);

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'No pantry selected. Please select a pantry first.',
      );
      expect(params.createPantryItem).not.toHaveBeenCalled();
    });
  });

  describe('add mode', () => {
    it('calls createPantryItem with form input + pantry context', async () => {
      const params = defaults({ selectedLocationId: 'loc-1', selectedCategoryId: 'cat-1' });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave(baseData);
      await new Promise(r => setImmediate(r));

      expect(params.createPantryItem).toHaveBeenCalledWith({
        input: baseData,
        pantryId: 'pantry-1',
        quantityValue: 2,
        unitId: 'unit-1',
        selectedLocationId: 'loc-1',
        selectedCategoryId: 'cat-1',
      });
    });

    it('resolves unitId from symbol when trackingUnit.id is null', async () => {
      const resolveUnitId = jest.fn().mockResolvedValue('resolved-unit');
      const params = defaults({
        trackingUnit: { id: null, name: null, symbol: null, type: null },
        resolveUnitId,
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave(baseData);
      await new Promise(r => setImmediate(r));

      expect(resolveUnitId).toHaveBeenCalledWith(null, 'L');
      expect(params.createPantryItem).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: 'resolved-unit' }),
      );
    });

    it('resolves netWeight unit from symbol text when not weight-locked', async () => {
      const resolveUnitId = jest
        .fn()
        .mockResolvedValueOnce('unit-1')
        .mockResolvedValueOnce('nw-unit');
      const params = defaults({
        trackingUnit: { id: null, name: null, symbol: null, type: null },
        netWeightUnitId: null,
        resolveUnitId,
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      const data = { ...baseData, netWeightUnit: 'oz' };
      result.current.handleSave(data);
      await new Promise(r => setImmediate(r));

      expect(resolveUnitId).toHaveBeenCalledWith(null, 'oz');
      expect(data.netWeightUnitId).toBe('nw-unit');
    });

    it('skips netWeight unit resolution when weight-locked', async () => {
      const resolveUnitId = jest.fn().mockResolvedValue('x');
      const params = defaults({
        isWeightLocked: true,
        trackingUnit: { id: 'u', name: null, symbol: null, type: null },
        resolveUnitId,
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave({ ...baseData, netWeightUnit: 'oz' });
      await new Promise(r => setImmediate(r));

      expect(resolveUnitId).not.toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const editParams = (
      overrides: Partial<UsePantryItemFormSubmitParams> = {},
    ) =>
      defaults({
        mode: 'edit',
        itemId: 'item-1',
        existingItemData: {
          pantryItem: {
            id: 'item-1',
            unit: { symbol: 'L' },
          },
        },
        ...overrides,
      });

    it('alerts when editing without an existing item', async () => {
      const params = editParams({ existingItemData: null });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave(baseData);
      await new Promise(r => setImmediate(r));

      expect(alertService.alert).toHaveBeenCalledWith('Error', 'Item not found');
    });

    it('calls updateQuantity when quantityInput is dirty', async () => {
      const params = editParams({ dirtyFields: { quantityInput: true } });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave(baseData);
      await new Promise(r => setImmediate(r));

      expect(params.updateQuantity).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'item-1',
          quantityValue: 2,
          unitId: 'unit-1',
        }),
      );
    });

    it('detects unit change from typed symbol vs current item', async () => {
      const params = editParams({ dirtyFields: {} });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave({ ...baseData, unit: 'kg' });
      await new Promise(r => setImmediate(r));

      // unit changed from 'L' (current) to 'kg' (typed) but trackingUnit still has 'L'
      // unitId is 'unit-1' (from trackingUnit), so unitChangedWithoutId is false
      expect(params.updateQuantity).toHaveBeenCalled();
    });

    it('routes unit-only change without unitId through updatePantryItemFields', async () => {
      const params = editParams({
        trackingUnit: { id: null, name: null, symbol: null, type: null },
        resolveUnitId: jest.fn().mockResolvedValue(null),
        dirtyFields: {},
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave({ ...baseData, unit: 'kg' });
      await new Promise(r => setImmediate(r));

      expect(params.updatePantryItemFields).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'item-1',
          unitSymbol: 'kg',
        }),
      );
      // updateQuantity NOT called because unitChangedWithoutId
      expect(params.updateQuantity).not.toHaveBeenCalled();
    });

    it('strips weight fields from dirtyFields when locked', async () => {
      const params = editParams({
        isWeightLocked: true,
        dirtyFields: { netWeight: true, notes: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave(baseData);
      await new Promise(r => setImmediate(r));

      const call = (params.updatePantryItemFields as jest.Mock).mock.calls[0][0];
      expect(call.dirtyFields.netWeight).toBeUndefined();
      expect(call.dirtyFields.notes).toBe(true);
    });

    it('calls onSuccess when nothing changed', async () => {
      const params = editParams({ dirtyFields: {} });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      // unit unchanged because data.unit === currentItem.unit.symbol === 'L'
      result.current.handleSave(baseData);
      await new Promise(r => setImmediate(r));

      expect(params.onSuccess).toHaveBeenCalled();
      expect(params.updateQuantity).not.toHaveBeenCalled();
      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('alerts on add-mode failure with mode-specific message', async () => {
      const params = defaults({
        createPantryItem: jest.fn().mockRejectedValue(new Error('boom')),
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave(baseData);
      await new Promise(r => setImmediate(r));

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to add pantry item. Please try again.',
      );
    });

    it('alerts on edit-mode failure with mode-specific message', async () => {
      const params = defaults({
        mode: 'edit',
        itemId: 'item-1',
        existingItemData: {
          pantryItem: { id: 'item-1', unit: { symbol: 'L' } },
        },
        dirtyFields: { quantityInput: true },
        updateQuantity: jest.fn(() => {
          throw new Error('boom');
        }),
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      result.current.handleSave(baseData);
      await new Promise(r => setImmediate(r));

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to update pantry item. Please try again.',
      );
    });
  });
});
