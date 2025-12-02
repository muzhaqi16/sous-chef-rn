import { useCallback, useState } from 'react';

import { ShoppingListItemFragment } from '#generated';
import { parseFractionalInput } from '#/utils';

type FormState = {
  itemName: string;
  quantityInput: string;
  unit: string;
  selectedUnitId: string | null;
  notes: string;
  category: string;
};

const DEFAULT_FORM_STATE: FormState = {
  itemName: '',
  quantityInput: '1',
  unit: '',
  selectedUnitId: null,
  notes: '',
  category: '',
};

export function useShoppingListItemForm(initialState?: Partial<FormState>) {
  const [formState, setFormState] = useState<FormState>({
    ...DEFAULT_FORM_STATE,
    ...initialState,
  });

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setFormState(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const setFromItem = useCallback((item: ShoppingListItemFragment) => {
    setFormState({
      itemName: item.itemName || '',
      quantityInput: item.quantityInput || item.quantity?.toString() || '1',
      unit: item.unitName || '',
      notes: item.notes || '',
      category: item.category || '',
      selectedUnitId: item.unit?.id || null,
    });
  }, []);

  const buildUnitInput = useCallback(() => {
    return {
      unitName: formState.unit,
      ...(formState.selectedUnitId && { unitId: formState.selectedUnitId }),
    };
  }, [formState.selectedUnitId, formState.unit]);

  const parseQuantityInput = useCallback(() => {
    const result = parseFractionalInput(formState.quantityInput);
    if (result === null || result <= 0) {
      return null;
    }
    return result;
  }, [formState.quantityInput]);

  return {
    formState,
    updateField,
    setFromItem,
    parseQuantityInput,
    buildUnitInput,
  } as const;
}
