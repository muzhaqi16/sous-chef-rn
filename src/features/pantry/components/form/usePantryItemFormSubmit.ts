import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { isUnchangedQuantity } from '#/utils/formatQuantity';
import { formatNumberForInput } from '#/utils/formatters/number';
import type { StorageType } from '#/graphql/generated/schemaTypes';
import type { FieldNamesMarkedBoolean } from 'react-hook-form';
import type {
  DirtyFieldFlags,
  UnitSelection,
} from '#features/pantry/hooks/mutations/types';
import type {
  PreviewOutcome,
  UnitChangePreview,
} from '#features/pantry/hooks/usePantryUnitChange';
import { isOwnKey } from '#/utils/isOwnKey';
import type { PantryItemForm_PantryItemFragment } from './PantryItemForm.generated';
import type { PantryItemFormData } from './PantryItemForm';

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
}

/** A unit change the user is asked to confirm: the target and its preview. */
export interface UnitChangeConfirmation {
  unitId: string;
  /** The amount the form holds, read as the stack in the new unit. */
  quantity: number | null;
  preview: UnitChangePreview;
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
  /** What moving the stack onto `unitId` would do. */
  previewUnitChange: (request: {
    unitId: string;
    quantity: number | null;
  }) => Promise<PreviewOutcome>;
  /** Shows the preview; resolves true once the change was made. */
  confirmUnitChange: (confirmation: UnitChangeConfirmation) => Promise<boolean>;
  /** Reports a problem the user can fix on the field it concerns. */
  reportFieldError: (field: 'unit' | 'netWeightUnit', message: string) => void;
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

/**
 * Returns a `handleSave` function for PantryItemForm. Extracted so the branch
 * logic (dirty-field routing, unit resolution, the unit change and its
 * confirmation) can be unit-tested directly without spinning up the full form.
 */
export function usePantryItemFormSubmit(params: UsePantryItemFormSubmitParams) {
  /** Moves the stack onto `unitId`; false when it did not happen. */
  const changeUnit = async (
    unitId: string,
    quantity: number | null,
  ): Promise<boolean> => {
    const outcome = await params.previewUnitChange({ unitId, quantity });
    if (outcome.status !== 'ready') {
      params.reportFieldError(
        'unit',
        t(
          outcome.status === 'offline'
            ? 'unitChange.needsConnection'
            : 'unitChange.previewFailed',
        ),
      );
      return false;
    }
    return params.confirmUnitChange({
      unitId,
      quantity,
      preview: outcome.preview,
    });
  };

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

    try {
      const unitTyped = !!typedUnit && typedUnit !== currentItem.unit.symbol;
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

      const unitChanged = !!unitId && unitId !== currentItem.unit.id;
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
        // The quantity typed with a new unit is what the stack holds in it.
        const changed = await changeUnit(
          unitId,
          quantityChanged ? typedQuantity : null,
        );
        if (!changed) return;
      } else if (quantityChanged && typedQuantity) {
        // The seed is rounded to three places; sent back unedited it would
        // rewrite the stock, so the stored value goes instead.
        const keepsStored = isUnchangedQuantity(
          typedQuantity,
          currentItem.quantity,
        );
        const stands = await params.updateQuantity({
          itemId,
          quantityInput: keepsStored
            ? formatNumberForInput(currentItem.quantity)
            : data.quantityInput ?? typedQuantity.toString(),
          quantityValue: keepsStored ? currentItem.quantity : typedQuantity,
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
