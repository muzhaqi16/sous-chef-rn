import { useState } from 'react';

import { type UseShoppingListItemForm_ItemFragment } from './useShoppingListItemForm.generated';
import {
  type UpdateShoppingListItemInput,
  type UnitSpecInput,
} from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { formatNumberForInput } from '#/utils/formatters/number';

type FormState = {
  itemName: string;
  quantityInput: string;
  unit: string;
  selectedUnitId: string | null;
  notes: string;
  category: string;
  estimatedPrice: string;
  /** Priority Int (0 low, 1 medium, 2 high); see shoppingList/utils/priority. */
  priority: number;
  /** Preferred store (storePrefs.preferredStoreId). */
  storeId: string | null;
  storeName: string;
  /** Brand as typed; `brandId` is set only by picking a suggestion. */
  brand: string;
  brandId: string | null;
  /** Package size (net weight) as typed, plus its unit. */
  netWeight: string;
  netWeightUnit: string;
  netWeightUnitId: string | null;
};

type DirtyFields = {
  itemName: boolean;
  quantityInput: boolean;
  unit: boolean;
  selectedUnitId: boolean;
  notes: boolean;
  category: boolean;
  estimatedPrice: boolean;
  priority: boolean;
  storeId: boolean;
  brand: boolean;
  brandId: boolean;
  netWeight: boolean;
  netWeightUnit: boolean;
  netWeightUnitId: boolean;
};

const DEFAULT_FORM_STATE: FormState = {
  itemName: '',
  quantityInput: '1',
  unit: '',
  selectedUnitId: null,
  notes: '',
  category: '',
  estimatedPrice: '',
  priority: 0,
  storeId: null,
  storeName: '',
  brand: '',
  brandId: null,
  netWeight: '',
  netWeightUnit: '',
  netWeightUnitId: null,
};

const DEFAULT_DIRTY_FIELDS: DirtyFields = {
  itemName: false,
  quantityInput: false,
  unit: false,
  selectedUnitId: false,
  notes: false,
  category: false,
  estimatedPrice: false,
  priority: false,
  storeId: false,
  brand: false,
  brandId: false,
  netWeight: false,
  netWeightUnit: false,
  netWeightUnitId: false,
};

export function useShoppingListItemForm(initialState?: Partial<FormState>) {
  const [formState, setFormState] = useState<FormState>({
    ...DEFAULT_FORM_STATE,
    ...initialState,
  });

  // Track initial state for dirty field comparison (edit mode)
  const [savedInitialState, setSavedInitialState] = useState<FormState | null>(
    null,
  );

  // Compute dirty fields by comparing current state with initial state
  const dirtyFields: DirtyFields = (() => {
    if (!savedInitialState) return DEFAULT_DIRTY_FIELDS;
    return {
      itemName: formState.itemName !== savedInitialState.itemName,
      quantityInput:
        formState.quantityInput !== savedInitialState.quantityInput,
      unit: formState.unit !== savedInitialState.unit,
      selectedUnitId:
        formState.selectedUnitId !== savedInitialState.selectedUnitId,
      notes: formState.notes !== savedInitialState.notes,
      category: formState.category !== savedInitialState.category,
      estimatedPrice:
        formState.estimatedPrice !== savedInitialState.estimatedPrice,
      priority: formState.priority !== savedInitialState.priority,
      storeId: formState.storeId !== savedInitialState.storeId,
      brand: formState.brand !== savedInitialState.brand,
      brandId: formState.brandId !== savedInitialState.brandId,
      netWeight: formState.netWeight !== savedInitialState.netWeight,
      netWeightUnit:
        formState.netWeightUnit !== savedInitialState.netWeightUnit,
      netWeightUnitId:
        formState.netWeightUnitId !== savedInitialState.netWeightUnitId,
    };
  })();

  const hasDirtyFields = Object.values(dirtyFields).some(Boolean);

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const setFromItem = (item: UseShoppingListItemForm_ItemFragment) => {
    const state: FormState = {
      itemName: item.itemName || '',
      quantityInput:
        item.quantityInput || formatNumberForInput(item.quantity) || '1',
      unit: item.unitName || '',
      notes: item.notes || '',
      category: item.category || '',
      selectedUnitId: item.unit?.id || null,
      estimatedPrice: formatNumberForInput(item.priceEstimate?.estimated),
      priority: item.priority ?? 0,
      storeId: item.storeInfo?.preferredStore?.id || null,
      storeName: item.storeInfo?.preferredStore?.name || '',
      brand: item.brand?.name || '',
      brandId: item.brand?.id || null,
      netWeight: formatNumberForInput(item.netWeight),
      netWeightUnit:
        item.netWeightUnit?.symbol || item.netWeightUnit?.name || '',
      netWeightUnitId: item.netWeightUnit?.id || null,
    };
    setFormState(state);
    setSavedInitialState(state); // Save initial state for dirty comparison
  };

  /**
   * A net weight with no unit is a number without a meaning, and the create
   * path rejects it outright. Screens alert on this before saving; in edit
   * mode the item's own unit satisfies it.
   */
  const netWeightNeedsUnit =
    !!formState.netWeight.trim() && !formState.netWeightUnitId;

  /** Parsed net weight, or undefined when the field is empty or not a number. */
  const parseNetWeightInput = (): number | undefined => {
    if (!formState.netWeight.trim()) return undefined;
    const value = parseDecimalInput(formState.netWeight);
    return Number.isFinite(value) ? value : undefined;
  };

  const buildUnitInput = (): { unit: UnitSpecInput } | {} => {
    if (!formState.unit && !formState.selectedUnitId) return {};
    return {
      unit: {
        unitName: formState.unit,
        ...(formState.selectedUnitId && { unitId: formState.selectedUnitId }),
      },
    };
  };

  // Build partial input with only dirty fields (for edit mode)
  // Sends raw quantityInput string - server handles conversion via FlexibleQuantity
  const buildDirtyInput = (): Partial<UpdateShoppingListItemInput> => {
    const input: Partial<UpdateShoppingListItemInput> = {};

    if (dirtyFields.itemName) {
      input.itemName = formState.itemName;
    }

    if (dirtyFields.quantityInput) {
      // Send raw string - server accepts FlexibleQuantity ("1/3", "1 1/4", "0.5", etc.)
      input.quantity = formState.quantityInput;
    }

    // Unit — nest into UnitSpecInput
    if (dirtyFields.unit || dirtyFields.selectedUnitId) {
      input.unit = {
        unitName: formState.unit,
        ...(formState.selectedUnitId && { unitId: formState.selectedUnitId }),
      };
    }

    if (dirtyFields.notes) {
      input.notes = formState.notes;
    }

    if (dirtyFields.category) {
      input.category = formState.category;
    }

    // Pricing — nest into PricingEstimatesInput
    if (dirtyFields.estimatedPrice && formState.estimatedPrice) {
      input.pricing = {
        estimatedPrice: parseDecimalInput(formState.estimatedPrice),
      };
    }

    if (dirtyFields.priority) {
      input.priority = formState.priority;
    }

    // Store — nest preferred store into StorePreferencesInput.
    if (dirtyFields.storeId) {
      input.storePrefs = { preferredStoreId: formState.storeId };
    }

    // Brand — BrandReferenceInput. The server lets brandId win over brandName
    // and find-or-creates a name it does not know; an explicit `brandId: null`
    // is the only way to remove one (omitting the sub-input leaves it alone).
    if (dirtyFields.brand || dirtyFields.brandId) {
      const brandName = formState.brand.trim();
      input.brand = formState.brandId
        ? { brandId: formState.brandId }
        : brandName
        ? { brandName }
        : { brandId: null };
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
              ...(formState.netWeightUnitId && {
                netWeightUnitId: formState.netWeightUnitId,
              }),
            };
    }

    return input;
  };

  const parseQuantityInput = () => {
    const result = parseFractionalInput(formState.quantityInput);
    if (result === null || result <= 0) {
      return null;
    }
    return result;
  };

  return {
    formState,
    dirtyFields,
    hasDirtyFields,
    updateField,
    setFromItem,
    parseQuantityInput,
    parseNetWeightInput,
    netWeightNeedsUnit,
    buildUnitInput,
    buildDirtyInput,
  };
}
