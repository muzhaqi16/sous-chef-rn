import { useCallback, useMemo, useState } from 'react';

import { ShoppingListItemFragment } from '#generated';
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
  const [savedInitialState, setSavedInitialState] = useState<FormState | null>(null);

  // Compute dirty fields by comparing current state with initial state
  const dirtyFields = useMemo<DirtyFields>(() => {
    if (!savedInitialState) return DEFAULT_DIRTY_FIELDS;
    return {
      itemName: formState.itemName !== savedInitialState.itemName,
      quantityInput: formState.quantityInput !== savedInitialState.quantityInput,
      unit: formState.unit !== savedInitialState.unit,
      selectedUnitId: formState.selectedUnitId !== savedInitialState.selectedUnitId,
      notes: formState.notes !== savedInitialState.notes,
      category: formState.category !== savedInitialState.category,
      estimatedPrice: formState.estimatedPrice !== savedInitialState.estimatedPrice,
    };
  }, [formState, savedInitialState]);

  const hasDirtyFields = useMemo(
    () => Object.values(dirtyFields).some(Boolean),
    [dirtyFields],
  );

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setFormState(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const setFromItem = useCallback((item: ShoppingListItemFragment) => {
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
  }, []);

  const buildUnitInput = useCallback(() => {
    return {
      unitName: formState.unit,
      ...(formState.selectedUnitId && { unitId: formState.selectedUnitId }),
    };
  }, [formState.selectedUnitId, formState.unit]);

  // Build partial input with only dirty fields (for edit mode)
  // Sends raw quantityInput string - server handles conversion via FlexibleQuantity
  const buildDirtyInput = useCallback(() => {
    const input: Record<string, any> = {};

    if (dirtyFields.itemName) {
      input.itemName = formState.itemName;
    }

    if (dirtyFields.quantityInput) {
      // Send raw string - server accepts FlexibleQuantity ("1/3", "1 1/4", "0.5", etc.)
      input.quantity = formState.quantityInput;
    }

    // Send unit fields together if either changed
    if (dirtyFields.unit || dirtyFields.selectedUnitId) {
      input.unitName = formState.unit;
      if (formState.selectedUnitId) {
        input.unitId = formState.selectedUnitId;
      }
    }

    if (dirtyFields.notes) {
      input.notes = formState.notes;
    }

    if (dirtyFields.category) {
      input.category = formState.category;
    }

    if (dirtyFields.estimatedPrice && formState.estimatedPrice) {
      input.estimatedPrice = parseFloat(formState.estimatedPrice);
    }

    return input;
  }, [dirtyFields, formState]);

  const parseQuantityInput = useCallback(() => {
    const result = parseFractionalInput(formState.quantityInput);
    if (result === null || result <= 0) {
      return null;
    }
    return result;
  }, [formState.quantityInput]);

  return {
    formState,
    dirtyFields,
    hasDirtyFields,
    updateField,
    setFromItem,
    parseQuantityInput,
    buildUnitInput,
    buildDirtyInput,
  } as const;
}
