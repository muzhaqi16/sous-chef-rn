import { useState } from 'react';

import { type UseShoppingListItemForm_ItemFragment } from './useShoppingListItemForm.generated';
import {
  type UpdateShoppingListItemInput,
  type UnitSpecInput,
} from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';

type FormState = {
  itemName: string;
  quantityInput: string;
  unit: string;
  selectedUnitId: string | null;
  notes: string;
  category: string;
  estimatedPrice: string;
};

type DirtyFields = {
  itemName: boolean;
  quantityInput: boolean;
  unit: boolean;
  selectedUnitId: boolean;
  notes: boolean;
  category: boolean;
  estimatedPrice: boolean;
};

const DEFAULT_FORM_STATE: FormState = {
  itemName: '',
  quantityInput: '1',
  unit: '',
  selectedUnitId: null,
  notes: '',
  category: '',
  estimatedPrice: '',
};

const DEFAULT_DIRTY_FIELDS: DirtyFields = {
  itemName: false,
  quantityInput: false,
  unit: false,
  selectedUnitId: false,
  notes: false,
  category: false,
  estimatedPrice: false,
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
      quantityInput: item.quantityInput || item.quantity?.toString() || '1',
      unit: item.unitName || '',
      notes: item.notes || '',
      category: item.category || '',
      selectedUnitId: item.unit?.id || null,
      estimatedPrice: item.priceEstimate?.estimated?.toString() || '',
    };
    setFormState(state);
    setSavedInitialState(state); // Save initial state for dirty comparison
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
      input.pricing = { estimatedPrice: parseFloat(formState.estimatedPrice) };
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
    buildUnitInput,
    buildDirtyInput,
  };
}
