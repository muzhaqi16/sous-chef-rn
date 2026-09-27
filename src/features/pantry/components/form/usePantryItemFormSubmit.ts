import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  formatQuantityForDisplay,
  isUnchangedQuantity,
} from '#/utils/formatQuantity';
import { formatNumberForInput } from '#/utils/formatters/number';
import type { StorageType } from '#/graphql/generated/schemaTypes';
import type { FieldNamesMarkedBoolean } from 'react-hook-form';
import type {
  DirtyFieldFlags,
  UnitSelection,
} from '#features/pantry/hooks/mutations/types';
import { isOwnKey } from '#/utils/isOwnKey';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import type { PantryItemForm_PantryItemFragment } from './PantryItemForm.generated';
import type { PantryItemFormData } from './PantryItemForm';
import { editedAmount } from './editedAmount';
import {
  runUnitChange,
  type UnitChangeDeps,
  type UnitChangeField,
} from './unitChangeFlow';

/** react-hook-form's `formState.dirtyFields` for this form. */
type FormDirtyFields = Partial<
  Readonly<FieldNamesMarkedBoolean<PantryItemFormData>>
>;

/** Argument shapes for the mutation primitives, matching this hook's call sites. */
interface UpdatePantryItemFieldsArgs {
  itemId: string;
  input: PantryItemFormData;
  dirtyFields: DirtyFieldFlags;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
  selectedStorageLocation: {
    id: string;
    name: string;
    type: StorageType;
  } | null;
}

interface UpdateQuantityArgs {
  itemId: string;
  quantityInput: string;
  quantityValue: number;
  statedIn?: { id: string; symbol: string; conversionFactor: number } | null;
}

export interface UsePantryItemFormSubmitParams {
  itemId: string | undefined;
  currentPantryId: string | undefined | null;
  existingPantryItem: PantryItemForm_PantryItemFragment | null;
  dirtyFields: FormDirtyFields;
  trackingUnit: UnitSelection;
  netWeightUnitId: string | null;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
  selectedCategoryId: string | null;
  selectedStorageLocation: {
    id: string;
    name: string;
    type: StorageType;
  } | null;
  /** Mutation primitives; each resolves false when its write was refused. */
  updatePantryItemFields: (
    args: UpdatePantryItemFieldsArgs,
  ) => Promise<boolean>;
  updateQuantity: (args: UpdateQuantityArgs) => Promise<boolean>;
  resolveUnitId: (id: string | null, symbol: string) => Promise<string | null>;
  /** Previews and makes a unit change, bound to this item. */
  unitChange: Pick<UnitChangeDeps, 'preview' | 'change'>;
  /** Reports a problem the user can fix on the field it concerns. */
  reportFieldError: (
    field: UnitChangeField | 'netWeightUnit',
    message: string,
  ) => void;
  /** Runs once every write was applied or queued; a refusal keeps the form open. */
  onSuccess?: () => void;
}

// react-hook-form marks a dirty array field with an array of flags; every
// consumer reads a field's entry for truthiness only.
function toDirtyFlags(dirtyFields: FormDirtyFields): DirtyFieldFlags {
  const flags: DirtyFieldFlags = {};
  for (const [field, value] of Object.entries(dirtyFields)) {
    if (isOwnKey(dirtyFields, field)) flags[field] = Boolean(value);
  }
  return flags;
}

/** The form's net weight and its resolved unit, when both are given. */
function packageSizeOf(data: PantryItemFormData) {
  const netWeight = parseDecimalInput(data.netWeight ?? '');
  const netWeightUnitId = data.netWeightUnitId;
  if (isNaN(netWeight) || netWeight <= 0 || !netWeightUnitId) return undefined;
  return { netWeight, netWeightUnitId };
}

/**
 * Returns a `handleSave` function for PantryItemForm. Extracted so the branch
 * logic (dirty-field routing, unit resolution, the unit change and its
 * confirmation) can be unit-tested directly without spinning up the full form.
 */
export function usePantryItemFormSubmit(params: UsePantryItemFormSubmitParams) {
  const handleSave = async (data: PantryItemFormData) => {
    const typedQuantity = parseFractionalInput(data.quantityInput ?? '');
    const typedUnit = (data.unit || '').trim();
    const netWeightUnitText = (data.netWeightUnit ?? '').trim();

    if (!params.currentPantryId) {
      alertService.alert(t('labels.error'), t('itemForm.noPantrySelected'));
      return;
    }
    const currentItem = params.existingPantryItem;
    if (!currentItem || !params.itemId) {
      alertService.alert(t('labels.error'), t('errors.itemNotFound'));
      return;
    }
    const itemId = params.itemId;
    // What the form shows: "1 doz" for 12 pc shown in dozens.
    const edited = editedAmount(currentItem);

    try {
      const unitTyped = !!typedUnit && typedUnit !== edited.unit.symbol;
      const unitId =
        params.trackingUnit.id ??
        (unitTyped ? await params.resolveUnitId(null, typedUnit) : null);
      if (unitTyped && !unitId) {
        params.reportFieldError(
          'unit',
          t('itemForm.unknownUnit', { unit: typedUnit }),
        );
        return;
      }

      if (netWeightUnitText) {
        const resolvedNetWeightUnitId =
          params.netWeightUnitId ??
          (await params.resolveUnitId(null, netWeightUnitText));
        if (!resolvedNetWeightUnitId) {
          params.reportFieldError(
            'netWeightUnit',
            t('itemForm.unknownUnit', { unit: netWeightUnitText }),
          );
          return;
        }
        data.netWeightUnitId = resolvedNetWeightUnitId;
      }

      const dirtyFieldsRecord = toDirtyFlags(params.dirtyFields);
      // `unit` only relabels on this path; a different unit is its own change.
      delete dirtyFieldsRecord.unit;

      // The dozen the stack is already shown in: the amount is stated in it,
      // and nothing about the unit changes (11 pc shown in dozens, set to 1 doz).
      const shownIn = currentItem.displayUnit;
      const statedInShown =
        !!unitId && unitId !== edited.unit.id && unitId === shownIn?.id;
      const unitChanged =
        !!unitId && unitId !== edited.unit.id && !statedInShown;
      const quantityChanged = !!dirtyFieldsRecord.quantityInput;
      const hasFieldChanges = Object.entries(dirtyFieldsRecord).some(
        ([field, dirty]) => field !== 'quantityInput' && dirty,
      );

      // Only a quantity being sent is judged: an empty stack stays editable.
      if (quantityChanged && (!typedQuantity || typedQuantity <= 0)) {
        alertService.alert(t('labels.error'), t('errors.invalidQuantity'));
        return;
      }

      if (unitChanged) {
        // The net weight is one package when a measure becomes a count.
        const changed = await runUnitChange(
          { ...params.unitChange, reportFieldError: params.reportFieldError },
          {
            unitId,
            // What the field shows, never the stored value it rounds: a
            // stack set to "1" holds exactly 1.
            amount:
              typedQuantity !== null && typedQuantity > 0
                ? typedQuantity
                : edited.quantity,
            packageSize: packageSizeOf(data),
            shownBefore: `${formatQuantityForDisplay(
              currentItem.displayAmount.quantity,
            )} ${currentItem.displayAmount.unit.symbol}`,
          },
        );
        if (!changed) return;
      } else if (quantityChanged && typedQuantity) {
        // The seed is rounded to three places; sent back unedited it would
        // rewrite the stock, so the stored value goes instead.
        const keepsStored =
          !statedInShown && isUnchangedQuantity(typedQuantity, edited.quantity);
        const stands = await params.updateQuantity({
          itemId,
          quantityInput: keepsStored
            ? formatNumberForInput(edited.quantity)
            : data.quantityInput ?? typedQuantity.toString(),
          quantityValue: keepsStored ? edited.quantity : typedQuantity,
          statedIn: statedInShown ? shownIn : edited.statedIn,
        });
        if (!stands) return;
      }

      // After the quantity write: the field update re-reads the version it
      // returns, or the server refuses it as a conflict.
      if (hasFieldChanges) {
        const fieldsStand = await params.updatePantryItemFields({
          itemId,
          input: data,
          dirtyFields: dirtyFieldsRecord,
          selectedLocationId: params.selectedLocationId,
          selectedBrandId: params.selectedBrandId,
          selectedStorageLocation: params.selectedStorageLocation,
        });
        if (!fieldsStand) return;
      }
      params.onSuccess?.();
    } catch (error) {
      errorService.reportError(error, {
        operation: 'updatePantryItem',
      });
      alertService.alert(t('labels.error'), t('itemForm.updateFailed'));
    }
  };

  return { handleSave };
}
