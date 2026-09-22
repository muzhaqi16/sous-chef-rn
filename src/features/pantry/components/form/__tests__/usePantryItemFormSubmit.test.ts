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

beforeEach(() => {
  jest.clearAllMocks();
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

function defaults(
  overrides: Partial<UsePantryItemFormSubmitParams> = {},
): UsePantryItemFormSubmitParams {
  return {
    // The hook is edit-only now: the form's `add` mode was a second create path
    // nothing could reach, so the create branch is gone with it.
    itemId: 'item-1',
    currentPantryId: 'pantry-1',
    isWeightLocked: false,
    existingPantryItem: {
      id: 'item-1',
      unit: { symbol: 'L' },
    } as PantryItemForm_PantryItemFragment,
    dirtyFields: {},
    trackingUnit: { id: 'unit-1', name: 'Liter', symbol: 'L', type: null },
    netWeightUnitId: null,
    selectedLocationId: null,
    selectedBrandId: null,
    selectedCategoryId: null,
    selectedStorageLocation: null,
    updatePantryItemFields: jest.fn(),
    updateQuantity: jest.fn().mockResolvedValue(true),
    resolveUnitId: jest.fn(),
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
      unit: { symbol: 'L' },
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

  describe('a unit-only edit keeps the stored quantity', () => {
    it('sends the stored value, not the seed rounded to three places', async () => {
      const params = defaults({
        existingPantryItem: {
          id: 'item-1',
          quantity: 1.23456,
          unit: { symbol: 'L' },
        } as PantryItemForm_PantryItemFragment,
        trackingUnit: {
          id: 'unit-kg',
          name: 'Kilogram',
          symbol: 'kg',
          type: null,
        },
        dirtyFields: { unit: true },
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({
        ...baseData,
        quantityInput: '1.235',
        unit: 'kg',
      });

      await waitFor(() =>
        expect(params.updateQuantity).toHaveBeenCalledWith(
          expect.objectContaining({
            quantityInput: '1.23456',
            quantityValue: 1.23456,
            unitId: 'unit-kg',
          }),
        ),
      );
    });
  });

  describe('unit resolution (runs before the update branch)', () => {
    it('resolves unitId from symbol when trackingUnit.id is null', async () => {
      const resolveUnitId = jest.fn().mockResolvedValue('resolved-unit');
      const params = defaults({
        trackingUnit: { id: null, name: null, symbol: null, type: null },
        dirtyFields: { quantityInput: true },
        resolveUnitId,
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave(baseData);

      await waitFor(() =>
        expect(params.updateQuantity).toHaveBeenCalledWith(
          expect.objectContaining({ unitId: 'resolved-unit' }),
        ),
      );
      expect(resolveUnitId).toHaveBeenCalledWith(null, 'L');
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
      await result.current.handleSave(data);

      await waitFor(() =>
        expect(resolveUnitId).toHaveBeenCalledWith(null, 'oz'),
      );
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

      await result.current.handleSave({ ...baseData, netWeightUnit: 'oz' });

      await waitFor(() => expect(params.onSuccess).toHaveBeenCalled());
      expect(resolveUnitId).not.toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const editParams = (
      overrides: Partial<UsePantryItemFormSubmitParams> = {},
    ) => defaults({ ...overrides });

    it('alerts when editing without an existing item', async () => {
      const params = editParams({ existingPantryItem: null });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave(baseData);

      await waitFor(() =>
        expect(alertService.alert).toHaveBeenCalledWith(
          'Error',
          'Item not found',
        ),
      );
    });

    it('calls updateQuantity when quantityInput is dirty', async () => {
      const params = editParams({ dirtyFields: { quantityInput: true } });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave(baseData);

      await waitFor(() =>
        expect(params.updateQuantity).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'item-1',
            quantityValue: 2,
            unitId: 'unit-1',
          }),
        ),
      );
    });

    it('detects unit change from typed symbol vs current item', async () => {
      const params = editParams({ dirtyFields: {} });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, unit: 'kg' });

      // unit is 'kg' (typed) against 'L' (current) but trackingUnit still has 'L'
      // unitId is 'unit-1' (from trackingUnit), so unitChangedWithoutId is false
      await waitFor(() => expect(params.updateQuantity).toHaveBeenCalled());
    });

    it('routes unit-only change without unitId through updatePantryItemFields', async () => {
      const params = editParams({
        trackingUnit: { id: null, name: null, symbol: null, type: null },
        resolveUnitId: jest.fn().mockResolvedValue(null),
        dirtyFields: {},
      });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      await result.current.handleSave({ ...baseData, unit: 'kg' });

      await waitFor(() =>
        expect(params.updatePantryItemFields).toHaveBeenCalledWith(
          expect.objectContaining({
            itemId: 'item-1',
            unitSymbol: 'kg',
          }),
        ),
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

      await result.current.handleSave(baseData);

      await waitFor(() =>
        expect(params.updatePantryItemFields).toHaveBeenCalled(),
      );
      const call = (params.updatePantryItemFields as jest.Mock).mock
        .calls[0][0];
      expect(call.dirtyFields.netWeight).toBeUndefined();
      expect(call.dirtyFields.notes).toBe(true);
    });

    it('calls onSuccess when nothing changed', async () => {
      const params = editParams({ dirtyFields: {} });
      const { result } = renderHook(() => usePantryItemFormSubmit(params));

      // unit unchanged because data.unit === currentItem.unit.symbol === 'L'
      await result.current.handleSave(baseData);

      await waitFor(() => expect(params.onSuccess).toHaveBeenCalled());
      expect(params.updateQuantity).not.toHaveBeenCalled();
      expect(params.updatePantryItemFields).not.toHaveBeenCalled();
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
          const { updatePantryItemFields } = useUpdatePantryItem({ onSuccess });
          const { updateQuantity } = useUpdatePantryItemQuantity({ onSuccess });
          return usePantryItemFormSubmit(
            defaults({
              existingPantryItem: {
                id: 'item-1',
                quantity: 2,
                unit: { symbol: 'L' },
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
    });
  });
});
