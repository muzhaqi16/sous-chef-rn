import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';
import { parseFractionalInput as parseQuantityInput } from '#/utils/fractionUtils';
import { StorageState, ItemCondition } from '#/graphql/generated/schemaTypes';
import type { UnitSelection } from '#features/pantry/hooks/mutations/types';
import type { PantryItemForm_PantryItemFragment } from './PantryItemForm.generated';

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
  storageState: StorageState;
  condition?: ItemCondition;
  location: string;
  expirationDate?: Date;
  notes: string;
  category: string;
}

/** Argument shapes for the mutation primitives, matching this hook's call sites. */
interface UpdatePantryItemFieldsArgs {
  itemId: string;
  input: PantryItemFormData;
  dirtyFields: Record<string, boolean>;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
  trackingUnit?: UnitSelection;
  selectedStorageLocation: { id: string; name: string; type: string } | null;
  unitSymbol?: string;
}

interface UpdateQuantityArgs {
  itemId: string;
  quantityInput: string;
  quantityValue: number;
  unitId: string | null;
  unitSymbol: string;
  trackingUnit: UnitSelection;
}

export interface UsePantryItemFormSubmitParams {
  itemId: string | undefined;
  currentPantryId: string | undefined | null;
  isWeightLocked: boolean;
  existingPantryItem: PantryItemForm_PantryItemFragment | null;
  dirtyFields: Record<string, unknown>;
  trackingUnit: UnitSelection;
  netWeightUnitId: string | null;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
  selectedCategoryId: string | null;
  selectedStorageLocation: { id: string; name: string; type: string } | null;
  /** Mutation primitives. */
  updatePantryItemFields: (args: UpdatePantryItemFieldsArgs) => unknown;
  updateQuantity: (args: UpdateQuantityArgs) => unknown;
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
  const handleSave = async (data: PantryItemFormData) => {
    const quantityValue = parseQuantityInput(data.quantityInput || '');
    if (!quantityValue || quantityValue <= 0) {
      alertService.alert(t('labels.error'), t('errors.invalidQuantity'));
      return;
    }

    if (!params.currentPantryId) {
      alertService.alert(t('labels.error'), t('itemForm.noPantrySelected'));
      return;
    }
    try {
      const unitId =
        params.trackingUnit.id ?? (await params.resolveUnitId(null, data.unit));

      const netWeightUnitText = (data.netWeightUnit || '').trim();
      if (!params.isWeightLocked && netWeightUnitText) {
        const resolvedNetWeightUnitId =
          params.netWeightUnitId ??
          (await params.resolveUnitId(null, netWeightUnitText));
        if (resolvedNetWeightUnitId) {
          data.netWeightUnitId = resolvedNetWeightUnitId;
        }
      }

      const currentItem = params.existingPantryItem;
      if (!currentItem || !params.itemId) {
        alertService.alert(t('labels.error'), t('errors.itemNotFound'));
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
        });
      }

      if (hasNonQuantityChanges || unitChangedWithoutId) {
        params.updatePantryItemFields({
          itemId: params.itemId,
          input: data,
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
    } catch (error) {
      errorService.reportError(error, {
        operation: 'updatePantryItem',
      });
      alertService.alert(t('labels.error'), t('itemForm.updateFailed'));
    }
  };

  return { handleSave };
}
