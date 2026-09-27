import {
  useForm,
  useWatch,
  type Resolver,
  type Path,
  type PathValue,
} from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import type { UseShoppingListItemForm_ItemFragment } from './useShoppingListItemForm.generated';
import type {
  BatchAddShoppingListItemInput,
  UpdateShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  normalizeNumericTextForApi,
  parseDecimalInput,
} from '#/utils/parseDecimalInput';
import { formatNumberForInput } from '#/utils/formatters/number';
import {
  formatQuantityForInput,
  parseStoredQuantityText,
} from '#/utils/formatQuantity';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { refByIdOrName } from '#/utils/refInput';
import { lineUnitFields } from '#features/shoppingList/utils/lineUnit';
import {
  shoppingItemSchema,
  SHOPPING_ITEM_DEFAULTS,
  DIRTY_TRACKED_FIELDS,
  type ShoppingItemFormData,
} from './shoppingItemFormConfig';

/**
 * The shopping-list item form, on react-hook-form. Shared by the `AddEditItem`
 * screen and the `AddToShoppingListSheet` details step, so neither can drift on
 * what is required, what the message says, or which fields count as dirty.
 * Validation renders ON the field, from one schema — never through an alert.
 */
export function useShoppingListItemForm(
  initialState?: Partial<ShoppingItemFormData>,
) {
  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    trigger,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<ShoppingItemFormData>({
    resolver: yupResolver(shoppingItemSchema) as Resolver<ShoppingItemFormData>,
    defaultValues: { ...SHOPPING_ITEM_DEFAULTS, ...initialState },
    // Re-validates as the user edits, so a message retires on the keystroke
    // that fixes it rather than surviving until the next submit.
    mode: 'onChange',
  });

  // Subscribed rather than read, because several derived values below feed
  // JSX (a disabled Save, the net-weight hint) and must re-render on change.
  const values = useWatch({ control }) as ShoppingItemFormData;

  /**
   * Replace the form with an existing item AND make it the dirty baseline:
   * `dirtyFields` is computed against the values passed here, so opening an item
   * and saving without touching it sends nothing.
   */
  const setFromItem = (item: UseShoppingListItemForm_ItemFragment) => {
    // The API echoes `quantityInput` as a float string, so it is re-formatted;
    // text no parser reads ("a pinch") stays as the person wrote it.
    const typed = item.quantityInput?.trim();
    const typedValue = typed ? parseStoredQuantityText(typed) : null;
    const netWeightUnitLabel = firstNonBlank(
      item.netWeightUnit?.symbol,
      item.netWeightUnit?.name,
    );
    reset({
      itemName: item.itemName ?? '',
      quantityInput:
        (typed && typedValue == null
          ? typed
          : formatQuantityForInput(typedValue ?? item.quantity)) || '1',
      unit: item.unitName ?? '',
      notes: item.notes ?? '',
      category: item.category ?? '',
      selectedUnitId: item.unit?.id ?? null,
      estimatedPrice: formatNumberForInput(item.priceEstimate.estimated),
      priority: item.priority,
      storeId: item.storeInfo.preferredStore?.id ?? null,
      storeName: item.storeInfo.preferredStore?.name ?? '',
      brand: item.brand?.name ?? '',
      brandId: item.brand?.id ?? null,
      netWeight: formatNumberForInput(item.netWeight),
      netWeightUnit: netWeightUnitLabel ?? '',
      netWeightUnitId: item.netWeightUnit?.id ?? null,
    });
  };

  /**
   * Set a field the user did not type into — the id behind an autocomplete pick,
   * or a value derived from another field. `shouldDirty` so it counts for edit
   * mode; `shouldValidate` so picking a unit clears its message immediately.
   */
  const setFieldValue = <K extends Path<ShoppingItemFormData>>(
    field: K,
    value: PathValue<ShoppingItemFormData, K>,
  ) => {
    // Excluded at the SOURCE, not subtracted from `isDirty` after: react-hook-form
    // mutates `dirtyFields` in place, so anything derived from it memoizes on an
    // identity that never changes. `isDirty` is a subscribed primitive.
    const tracked = DIRTY_TRACKED_FIELDS.includes(field);
    setValue(field, value, { shouldDirty: tracked, shouldValidate: true });
    // `shouldValidate` re-runs the rule on THIS field only, and the net-weight
    // rule lives on `netWeightUnit` while its inputs are `netWeight` and
    // `netWeightUnitId`. Both halves are triggered because each direction
    // reports on a different field.
    if (field === 'netWeight' || field === 'netWeightUnitId') {
      void trigger(['netWeightUnit', 'netWeight']);
    }
  };

  /** Parsed net weight, or undefined when the field is empty or not a number. */
  const parseNetWeightInput = (): number | undefined => {
    const raw = getValues('netWeight');
    if (!raw.trim()) return undefined;
    const value = parseDecimalInput(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const buildUnitInput = (): Pick<
    BatchAddShoppingListItemInput,
    'unit' | 'unitLabel'
  > => {
    const { unit, selectedUnitId } = getValues();
    return lineUnitFields(selectedUnitId, unit) ?? {};
  };

  // Only dirty fields, for edit mode. `dirtyFields` OMITS clean fields, so every
  // read below is a truthiness check, never `=== false`.
  const buildDirtyInput = (): Partial<UpdateShoppingListItemInput> => {
    const input: Partial<UpdateShoppingListItemInput> = {};
    const v = getValues();

    if (dirtyFields.itemName) {
      input.itemName = v.itemName;
    }

    if (dirtyFields.quantityInput) {
      // FlexibleQuantity reads "1/3", "1 1/4", "0.5" — a period decimal only.
      input.quantity = normalizeNumericTextForApi(v.quantityInput);
    }

    // An emptied unit clears the line's unit, and its label with it.
    if (dirtyFields.unit || dirtyFields.selectedUnitId) {
      Object.assign(
        input,
        lineUnitFields(v.selectedUnitId, v.unit) ?? { unit: null },
      );
    }

    if (dirtyFields.notes) {
      input.notes = v.notes;
    }

    if (dirtyFields.category) {
      input.category = v.category;
    }

    // An emptied price is a clear: `PricingEstimatesInput.estimatedPrice` takes null.
    if (dirtyFields.estimatedPrice) {
      input.pricing = {
        estimatedPrice: v.estimatedPrice
          ? parseDecimalInput(v.estimatedPrice)
          : null,
      };
    }

    if (dirtyFields.priority) {
      input.priority = v.priority;
    }

    // Store — nest preferred store into StorePreferencesInput.
    if (dirtyFields.storeId) {
      input.storePrefs = { preferredStoreId: v.storeId };
    }

    // The server find-or-creates a brand name it does not know; `brand: null`
    // is the only way to remove one (omitting it leaves the brand alone).
    if (dirtyFields.brand || dirtyFields.brandId) {
      input.brand = refByIdOrName(v.brandId, v.brand) ?? null;
    }

    // Net weight — NetWeightInput. `netWeight: null` clears the value and its
    // unit together on the server; a unit is only ever sent beside a value,
    // because a unit with no value is rejected. A value with no unit keeps the
    // row's existing unit.
    if (
      dirtyFields.netWeight ||
      dirtyFields.netWeightUnit ||
      dirtyFields.netWeightUnitId
    ) {
      const value = parseNetWeightInput();
      input.netWeight =
        value === undefined
          ? { netWeight: null }
          : {
              netWeight: value,
              ...(v.netWeightUnitId && {
                netWeightUnitId: v.netWeightUnitId,
              }),
            };
    }

    return input;
  };

  const parseQuantityInput = () => {
    const result = parseFractionalInput(getValues('quantityInput'));
    if (result === null || result <= 0) {
      return null;
    }
    return result;
  };

  return {
    // react-hook-form surface — fields render through `Controller control={control}`
    // and Save goes through `handleSubmit(onValid, logValidationErrors)`.
    control,
    handleSubmit,
    errors,
    /** Current values, subscribed — for logic and display, not for field wiring. */
    values,
    /** True when any SUBMITTED field changed — see `setFieldValue`. */
    hasDirtyFields: isDirty,
    setFieldValue,
    setFromItem,
    parseQuantityInput,
    parseNetWeightInput,
    buildUnitInput,
    buildDirtyInput,
  };
}
