import { renderHook, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import {
  ErrorCode,
  ItemCondition,
  StorageState,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import {
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { useUpdatePantryItem } from '#features/pantry/hooks/mutations/useUpdatePantryItem';
import { useUpdatePantryItemQuantity } from '#features/pantry/hooks/mutations/useUpdatePantryItemQuantity';
import type { PantryItemForm_PantryItemFragment } from '../PantryItemForm.generated';
import type { PantryItemFormData } from '../PantryItemForm';
import { runUnitChange } from '../unitChangeFlow';
import {
  usePantryItemFormSubmit,
  type UsePantryItemFormSubmitParams,
} from '../usePantryItemFormSubmit';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/utils/finallyHelpers', () => ({
  executeMutation: jest.fn(
    async (
      fn: () => Promise<unknown>,
      onError: string | ((error: unknown) => void | Promise<void>),
    ) => {
      try {
        await fn();
        return true;
      } catch (e) {
        if (typeof onError === 'function') await onError(e);
        return false;
      }
    },
  ),
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: jest.fn((input: string) => {
    const n = parseFloat(input);
    return isNaN(n) || n <= 0 ? null : n;
  }),
}));

// The unit change's preview, confirmation and refusals are its own suite
// (`unitChangeFlow.test.ts`); here, what the save hands it and does with it.
jest.mock('../unitChangeFlow');
const mockRunUnitChange = jest.mocked(runUnitChange);

beforeEach(() => {
  jest.clearAllMocks();
  mockRunUnitChange.mockResolvedValue(true);
});

const baseData: PantryItemFormData = {
  itemName: 'Milk',
  quantityInput: '2',
  unit: 'L',
  storageState: StorageState.Ambient,
  condition: ItemCondition.Good,
  location: '',
  notes: '',
  category: '',
  brand: '',
  netWeight: '',
  netWeightUnit: '',
  netWeightUnitId: '',
};

const KG = { id: 'unit-kg', name: 'Kilogram', symbol: 'kg', type: null };

function defaults(
  overrides: Partial<UsePantryItemFormSubmitParams> = {},
): UsePantryItemFormSubmitParams {
  return {
    // The hook is edit-only now: the form's `add` mode was a second create path
    // nothing could reach, so the create branch is gone with it.
    itemId: 'item-1',
    currentPantryId: 'pantry-1',
    existingPantryItem: {
      id: 'item-1',
      quantity: 2,
      unit: { id: 'unit-1', symbol: 'L' },
    } as PantryItemForm_PantryItemFragment,
    dirtyFields: {},
    trackingUnit: { id: 'unit-1', name: 'Liter', symbol: 'L', type: null },
    netWeightUnitId: null,
    selectedLocationId: null,
    selectedBrandId: null,
    selectedCategoryId: null,
    selectedStorageLocation: null,
    updatePantryItemFields: jest.fn().mockResolvedValue(true),
    updateQuantity: jest.fn().mockResolvedValue(true),
    resolveUnitId: jest.fn(),
    unitChange: { preview: jest.fn(), change: jest.fn() },
    reportFieldError: jest.fn(),
    onSuccess: jest.fn(),
    ...overrides,
  };
}

describe('usePantryItemFormSubmit', () => {
  describe('validation', () => {
    it('alerts when quantity is invalid', async () => {
      const params = defaults({ dirtyFields: { quantityInput: true } });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, quantityInput: '' });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Please enter a valid quantity',
      );
      expect(params.updateQuantity).not.toHaveBeenCalled();
      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
    });

    it('alerts when no pantry is selected', async () => {
      const params = defaults({ currentPantryId: null });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave(baseData);

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'No pantry selected. Please select a pantry first.',
      );
      expect(params.updateQuantity).not.toHaveBeenCalled();
      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
    });
  });

  describe('validation applies only to what changed', () => {
    const emptyStack = {
      id: 'item-1',
      quantity: 0,
      unit: { id: 'unit-1', symbol: 'L' },
    } as PantryItemForm_PantryItemFragment;

    it('saves a notes edit on a stack whose quantity is 0', async () => {
      const params = defaults({
        existingPantryItem: emptyStack,
        dirtyFields: { notes: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({
        ...baseData,
        quantityInput: '0',
        notes: 'Top shelf',
      });

      expect(alertService.alert).not.toHaveBeenCalled();
      expect(params.updatePantryItemFields).toHaveBeenCalled();
      expect(params.updateQuantity).not.toHaveBeenCalled();
    });

    it('still refuses a quantity changed to 0', async () => {
      const params = defaults({
        existingPantryItem: emptyStack,
        dirtyFields: { quantityInput: true, notes: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, quantityInput: '0' });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Please enter a valid quantity',
      );
      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
    });
  });

  describe('a unit change', () => {
    it('offers the stored amount when the quantity is untouched, and closes once changed', async () => {
      const params = defaults({
        trackingUnit: KG,
        dirtyFields: { unit: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, unit: 'kg' });

      expect(mockRunUnitChange).toHaveBeenCalledWith(
        expect.objectContaining({ reportFieldError: params.reportFieldError }),
        { unitId: 'unit-kg', amount: 2, packageSize: undefined },
      );
      // The quick set never carries a unit.
      expect(params.updateQuantity).not.toHaveBeenCalled();
      expect(params.onSuccess).toHaveBeenCalledTimes(1);
    });

    it('offers the amount the field shows, not the stored value it rounds', async () => {
      const params = defaults({
        trackingUnit: KG,
        dirtyFields: { unit: true },
        existingPantryItem: {
          id: 'item-1',
          quantity: 0.999996,
          unit: { id: 'unit-1', symbol: 'L' },
        } as PantryItemForm_PantryItemFragment,
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({
        ...baseData,
        unit: 'kg',
        quantityInput: '1',
      });

      expect(mockRunUnitChange).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ amount: 1 }),
      );
    });

    it('offers the amount typed with the new unit as the stock in it', async () => {
      // 2 pieces of chicken with no size, restated as 1/2 lb.
      const params = defaults({
        trackingUnit: KG,
        dirtyFields: { unit: true, quantityInput: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({
        ...baseData,
        unit: 'kg',
        quantityInput: '0.5',
      });

      expect(mockRunUnitChange).toHaveBeenCalledWith(expect.anything(), {
        unitId: 'unit-kg',
        amount: 0.5,
        packageSize: undefined,
      });
      expect(params.updateQuantity).not.toHaveBeenCalled();
    });

    it('offers the net weight as the size of one package', async () => {
      const params = defaults({
        trackingUnit: KG,
        dirtyFields: { unit: true },
        netWeightUnitId: 'u-oz',
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({
        ...baseData,
        unit: 'kg',
        netWeight: '32',
        netWeightUnit: 'oz',
      });

      expect(mockRunUnitChange).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          packageSize: { netWeight: 32, netWeightUnitId: 'u-oz' },
        }),
      );
    });

    it('stays open, saving nothing else, when the change is not made', async () => {
      mockRunUnitChange.mockResolvedValue(false);
      const params = defaults({
        trackingUnit: KG,
        dirtyFields: { unit: true, notes: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, unit: 'kg', notes: 'x' });

      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
      expect(params.onSuccess).not.toHaveBeenCalled();
    });

    it('saves the other edits after the unit change, never the unit itself', async () => {
      const params = defaults({
        trackingUnit: KG,
        dirtyFields: { unit: true, notes: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, unit: 'kg', notes: 'x' });

      const [call] = (params.updatePantryItemFields as jest.Mock).mock.calls[0];
      expect(call.dirtyFields).toEqual({ notes: true });
      expect(params.onSuccess).toHaveBeenCalledTimes(1);
    });

    it('reports a typed unit it cannot resolve on the field, and sends nothing', async () => {
      const params = defaults({
        trackingUnit: { id: null, name: null, symbol: null, type: null },
        resolveUnitId: jest.fn().mockResolvedValue(null),
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, unit: 'sticks of' });

      expect(params.reportFieldError).toHaveBeenCalledWith(
        'unit',
        '"sticks of" isn\'t a unit we recognise. Pick one from the list.',
      );
      expect(mockRunUnitChange).not.toHaveBeenCalled();
      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
    });

    it('resolves a typed unit before changing to it', async () => {
      const resolveUnitId = jest.fn().mockResolvedValue('unit-stick');
      const params = defaults({
        trackingUnit: { id: null, name: null, symbol: null, type: null },
        resolveUnitId,
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, unit: 'sticks' });

      expect(resolveUnitId).toHaveBeenCalledWith(null, 'sticks');
      expect(mockRunUnitChange).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ unitId: 'unit-stick' }),
      );
    });
  });

  describe('the net weight is the default for new stock', () => {
    it('resolves a typed net-weight unit to its id', async () => {
      const resolveUnitId = jest.fn().mockResolvedValue('nw-unit');
      const params = defaults({ dirtyFields: { netWeight: true } });
      const { result } = renderHook(() =>
        usePantryItemFormSubmit({ ...params, resolveUnitId }),
      );

      const data = { ...baseData, netWeight: '12', netWeightUnit: 'oz' };
      await result.current.handleSave(data);

      expect(resolveUnitId).toHaveBeenCalledWith(null, 'oz');
      expect(data.netWeightUnitId).toBe('nw-unit');
    });

    it('reports a net-weight unit it cannot resolve on the field, and saves nothing', async () => {
      const params = defaults({
        dirtyFields: { netWeight: true, netWeightUnit: true },
        resolveUnitId: jest.fn().mockResolvedValue(null),
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({
        ...baseData,
        netWeight: '12',
        netWeightUnit: 'ozz',
      });

      expect(params.reportFieldError).toHaveBeenCalledWith(
        'netWeightUnit',
        '"ozz" isn\'t a unit we recognise. Pick one from the list.',
      );
      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
      expect(params.onSuccess).not.toHaveBeenCalled();
    });

    it('is sent on a stack that has been used', async () => {
      const params = defaults({
        existingPantryItem: {
          id: 'item-1',
          quantity: 2,
          lastUsedAt: '2026-09-01',
          unit: { id: 'unit-1', symbol: 'L' },
        } as PantryItemForm_PantryItemFragment,
        dirtyFields: { netWeight: true },
        netWeightUnitId: 'u-oz',
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({
        ...baseData,
        netWeight: '32',
        netWeightUnit: 'oz',
      });

      const [call] = (params.updatePantryItemFields as jest.Mock).mock.calls[0];
      expect(call.dirtyFields.netWeight).toBe(true);
    });
  });

  describe('edit mode', () => {
    it('alerts when editing without an existing item', async () => {
      const params = defaults({ existingPantryItem: null });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave(baseData);

      await waitFor(() =>
        expect(alertService.alert).toHaveBeenCalledWith(
          'Error',
          'Item not found',
        ),
      );
    });

    it('sets the quantity in the same unit through the quick set', async () => {
      const params = defaults({ dirtyFields: { quantityInput: true } });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, quantityInput: '3' });

      expect(params.updateQuantity).toHaveBeenCalledWith({
        itemId: 'item-1',
        quantityInput: '3',
        quantityValue: 3,
      });
      expect(mockRunUnitChange).not.toHaveBeenCalled();
    });

    it('sends the stored value, not the seed rounded to three places', async () => {
      const params = defaults({
        existingPantryItem: {
          id: 'item-1',
          quantity: 1.23456,
          unit: { id: 'unit-1', symbol: 'L' },
        } as PantryItemForm_PantryItemFragment,
        dirtyFields: { quantityInput: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, quantityInput: '1.235' });

      expect(params.updateQuantity).toHaveBeenCalledWith(
        expect.objectContaining({
          quantityInput: '1.23456',
          quantityValue: 1.23456,
        }),
      );
    });

    it('calls onSuccess when nothing changed', async () => {
      const params = defaults({ dirtyFields: {} });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave(baseData);

      await waitFor(() => expect(params.onSuccess).toHaveBeenCalled());
      expect(params.updateQuantity).not.toHaveBeenCalled();
      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
    });
  });

  describe('the form closes only once every write stands', () => {
    it('stays open when the quantity write is refused', async () => {
      const params = defaults({
        dirtyFields: { quantityInput: true, notes: true },
        updateQuantity: jest.fn().mockResolvedValue(false),
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, quantityInput: '3' });

      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
      expect(params.onSuccess).not.toHaveBeenCalled();
    });

    it('stays open when the field write is refused', async () => {
      const params = defaults({
        dirtyFields: { notes: true },
        updatePantryItemFields: jest.fn().mockResolvedValue(false),
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, notes: 'Top shelf' });

      expect(params.updatePantryItemFields).toHaveBeenCalled();
      expect(params.onSuccess).not.toHaveBeenCalled();
    });

    it('closes once after both writes stand', async () => {
      const params = defaults({
        dirtyFields: { quantityInput: true, notes: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({
        ...baseData,
        quantityInput: '3',
        notes: 'Top shelf',
      });

      expect(params.onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('alerts on failure', async () => {
      const params = defaults({
        dirtyFields: { quantityInput: true },
        updateQuantity: jest.fn(() => {
          throw new Error('boom');
        }),
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave(baseData);

      await waitFor(() =>
        expect(alertService.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to update pantry item. Please try again.',
        ),
      );
    });
  });

  describe('a combined edit is sent in order', () => {
    const pantryItem = {
      __typename: 'PantryItem',
      id: 'item-1',
      pantryId: 'pantry-1',
      itemId: null,
      itemName: 'Milk',
      quantity: 2,
      heldQuantity: 2,
      version: 1,
      updatedAt: '2026-01-01',
      storageState: StorageState.Ambient,
      condition: ItemCondition.Good,
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
        name: 'Liter',
        symbol: 'L',
        type: UnitType.Volume,
        displayAsFraction: false,
      },
      netWeightUnit: null,
      storageLocation: null,
      packageBreakdown: null,
      quantityBreakdown: null,
      brand: null,
    };

    const STORED = gql`
      fragment StoredEdit on PantryItem {
        quantity
        storageNotes
        version
      }
    `;

    it('stores quantity and notes without a version conflict', async () => {
      // The server bumps the version on every write and refuses a stale one.
      let serverVersion = 1;
      const quantity = recordMock(UpdatePantryItemQuantityDocument, {
        dataFor: (
          vars,
        ): MockDataFor<typeof UpdatePantryItemQuantityDocument> => {
          const input = vars.input as { version: number };
          if (input.version !== serverVersion)
            return {
              updatePantryItemQuantity: {
                __typename: 'ConflictError',
                code: ErrorCode.VersionConflict,
              },
            };
          serverVersion += 1;
          return {
            updatePantryItemQuantity: {
              __typename: 'UpdatePantryItemQuantityPayload',
              pantryItem: {
                __typename: 'PantryItem',
                id: 'item-1',
                quantity: 3,
                version: serverVersion,
              },
            },
          };
        },
      });
      const fields = recordMock(UpdatePantryItemDocument, {
        dataFor: (vars): MockDataFor<typeof UpdatePantryItemDocument> => {
          const input = vars.input as { version: number };
          if (input.version !== serverVersion)
            return {
              updatePantryItem: {
                __typename: 'ConflictError',
                code: ErrorCode.VersionConflict,
              },
            };
          serverVersion += 1;
          return {
            updatePantryItem: {
              __typename: 'UpdatePantryItemPayload',
              pantryItem: {
                __typename: 'PantryItem',
                id: 'item-1',
                quantity: 3,
                storageNotes: 'Top shelf',
                version: serverVersion,
              },
            },
          };
        },
      });

      const cache = seedCache([pantryItem]);
      const onSuccess = jest.fn();
      const { result } = renderHookWithApollo(
        () => {
          const { updatePantryItemFields } = useUpdatePantryItem({});
          const { updateQuantity } = useUpdatePantryItemQuantity({});
          return usePantryItemFormSubmit(
            defaults({
              onSuccess,
              existingPantryItem: {
                id: 'item-1',
                quantity: 2,
                unit: { id: 'unit-1', symbol: 'L' },
              } as PantryItemForm_PantryItemFragment,
              dirtyFields: { quantityInput: true, notes: true },
              updatePantryItemFields,
              updateQuantity,
            }),
          );
        },
        { cache, operationMocks: [quantity.mock, fields.mock] },
      );

      await result.current.handleSave({
        ...baseData,
        quantityInput: '3',
        notes: 'Top shelf',
      });

      await waitFor(() => expect(fields.fired).toHaveLength(1));
      await waitFor(() =>
        expect(
          cache.readFragment({ id: 'PantryItem:item-1', fragment: STORED }),
        ).toEqual({
          __typename: 'PantryItem',
          quantity: 3,
          storageNotes: 'Top shelf',
          version: 3,
        }),
      );
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
