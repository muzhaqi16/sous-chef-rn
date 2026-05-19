import { alertService } from '#/services/alertService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { parseFractionalInput as parseQuantityInput } from '#/utils/fractionUtils';
import type { UnitSelection } from '#features/pantry/hooks/mutations/types';
import type { PantryItemFragment } from '#features/pantry/graphql/pantryFragments.generated';

/** All form fields PantryItemForm exposes through `useForm`. */
export interface PantryItemFormData {
  itemName?: string;
  selectedItemId?: string;
  brand?: string;
  quantityInput?: string;
  unit: string;
  tags?: string[];
  minQuantity?: string;
  restockQuantity?: string;
  netWeight?: string;
  netWeightUnit?: string;
  netWeightUnitId?: string;
  storageState: string;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
}

export interface UsePantryItemFormSubmitParams {
  mode: 'add' | 'edit';
  itemId: string | undefined;
  currentPantryId: string | undefined | null;
  isWeightLocked: boolean;
  existingPantryItem: PantryItemFragment | null;
  dirtyFields: Record<string, unknown>;
  trackingUnit: UnitSelection;
  netWeightUnitId: string | null;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
  selectedCategoryId: string | null;
  selectedStorageLocation: { id: string; name: string; type: string } | null;
  /** Mutation primitives. */
  createPantryItem: (args: any) => Promise<unknown>;
  updatePantryItemFields: (args: any) => unknown;
  updateQuantity: (args: any) => unknown;
  resolveUnitId: (id: string | null, symbol: string) => Promise<string | null>;
  /** Callback after a no-op edit. */
  onSuccess?: () => void;
}

/**
 * Returns a `handleSave` function for PantryItemForm. Extracted so the
 * 130-line branch logic (add vs edit, dirty-field routing, weight-lock
 * handling, unit-symbol resolution) can be unit-tested directly without
 * spinning up the full form.
 */
export function usePantryItemFormSubmit(params: UsePantryItemFormSubmitParams) {
  const handleSave = (data: PantryItemFormData) => {
    const quantityValue = parseQuantityInput(data.quantityInput || '');
    if (!quantityValue || quantityValue <= 0) {
      alertService.alert('Error', 'Please enter a valid quantity');
      return;
    }

    if (!params.currentPantryId) {
      alertService.alert(
        'Error',
        'No pantry selected. Please select a pantry first.',
      );
      return;
    }

    executeMutation(
      async () => {
        const unitId =
          params.trackingUnit.id ??
          (await params.resolveUnitId(null, data.unit));

        const netWeightUnitText = (data.netWeightUnit || '').trim();
        if (!params.isWeightLocked && netWeightUnitText) {
          const resolvedNetWeightUnitId =
            params.netWeightUnitId ??
            (await params.resolveUnitId(null, netWeightUnitText));
          if (resolvedNetWeightUnitId) {
            data.netWeightUnitId = resolvedNetWeightUnitId;
          }
        }

        if (params.mode === 'add') {
          await params.createPantryItem({
            input: data,
            pantryId: params.currentPantryId,
            quantityValue,
            unitId,
            selectedLocationId: params.selectedLocationId,
            selectedCategoryId: params.selectedCategoryId,
          });
          return;
        }

        const currentItem = params.existingPantryItem;
        if (!currentItem || !params.itemId) {
          alertService.alert('Error', 'Item not found');
          return;
        }

        const dirtyFieldsRecord = { ...params.dirtyFields } as Record<
          string,
          boolean
        >;

        if (params.isWeightLocked) {
          delete dirtyFieldsRecord.netWeight;
          delete dirtyFieldsRecord.netWeightUnitId;
        }

        const currentUnitSymbol = currentItem.unit?.symbol || '';
        const typedUnit = (data.unit || '').trim();
        if (typedUnit && typedUnit !== currentUnitSymbol) {
          dirtyFieldsRecord.unit = true;
        }

        const quantityChanged = !!dirtyFieldsRecord.quantityInput;
        const unitChanged = !!dirtyFieldsRecord.unit;
        const unitChangedWithoutId = unitChanged && !unitId;

        const hasNonQuantityChanges = Object.keys(dirtyFieldsRecord).some(
          k => k !== 'quantityInput' && k !== 'unit' && dirtyFieldsRecord[k],
        );

        if (quantityChanged || (unitChanged && !unitChangedWithoutId)) {
          params.updateQuantity({
            itemId: params.itemId,
            quantityInput: data.quantityInput || quantityValue.toString(),
            quantityValue,
            unitId: unitChangedWithoutId ? null : unitId,
            unitSymbol: data.unit,
            trackingUnit: params.trackingUnit,
            currentItem,
          });
        }

        if (hasNonQuantityChanges || unitChangedWithoutId) {
          params.updatePantryItemFields({
            itemId: params.itemId,
            input: data,
            currentItem,
            dirtyFields: dirtyFieldsRecord,
            selectedLocationId: params.selectedLocationId,
            selectedBrandId: params.selectedBrandId,
            trackingUnit:
              quantityChanged || unitChanged ? params.trackingUnit : undefined,
            selectedStorageLocation: params.selectedStorageLocation,
            unitSymbol: unitChangedWithoutId ? data.unit : undefined,
          });
        } else if (!quantityChanged && !unitChanged) {
          params.onSuccess?.();
        }
      },
      error => {
        console.error(
          `${params.mode === 'add' ? 'Add' : 'Update'} pantry item error:`,
          error,
        );
        alertService.alert(
          'Error',
          `Failed to ${
            params.mode === 'add' ? 'add' : 'update'
          } pantry item. Please try again.`,
        );
      },
    );
  };

  return { handleSave };
}
