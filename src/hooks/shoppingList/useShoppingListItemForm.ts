import { useCallback, useState } from 'react';

import { ShoppingListItemFragment } from '#generated';

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
    const trimmed = formState.quantityInput.trim();

    if (!trimmed) {
      return null;
    }

    try {
      let quantityValue: number;

      if (trimmed.includes('/')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length === 2) {
          const whole = parseInt(parts[0]);
          const [num, den] = parts[1].split('/').map(Number);
          quantityValue = whole + num / den;
        } else {
          const [num, den] = trimmed.split('/').map(Number);
          quantityValue = num / den;
        }
      } else {
        quantityValue = parseFloat(trimmed);
      }

      if (isNaN(quantityValue) || quantityValue <= 0) {
        return null;
      }

      return quantityValue;
    } catch (error) {
      return null;
    }
  }, [formState.quantityInput]);

  return {
    formState,
    updateField,
    setFromItem,
    parseQuantityInput,
    buildUnitInput,
  } as const;
}
