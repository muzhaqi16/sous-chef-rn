import { boolean, object, string, type ObjectSchema } from 'yup';
import type { IngredientFormState } from '#features/recipes/types';
import { formatQuantityForInput } from '#utils/formatQuantity';
import {
  lazyMessage,
  quantityCapMessage,
  withinQuantityCap,
} from '#utils/validation/common';

/** The sheet's fields, as typed. */
export interface IngredientFormValues {
  name: string;
  itemId: string | null;
  quantity: string;
  unit: string;
  unitId: string | null;
  preparation: string;
  section: string;
  notes: string;
  isOptional: boolean;
}

export const ingredientSchema: ObjectSchema<IngredientFormValues> = object({
  name: string().trim().required(lazyMessage('errors.itemNameRequired')),
  itemId: string().nullable().defined(),
  // Blank states no amount ("salt, to taste"); a stated one is held to the cap.
  quantity: string()
    .defined()
    .test('quantity-cap', quantityCapMessage, withinQuantityCap),
  unit: string().trim().defined(),
  unitId: string().nullable().defined(),
  preparation: string().trim().defined(),
  section: string().trim().defined(),
  notes: string().trim().defined(),
  isOptional: boolean().defined(),
});

export const valuesOf = (
  ingredient: IngredientFormState | undefined,
): IngredientFormValues =>
  ingredient
    ? {
        name: ingredient.name,
        itemId: ingredient.itemId ?? null,
        quantity: formatQuantityForInput(ingredient.quantity),
        unit: ingredient.unitLabel ?? '',
        unitId: ingredient.unitId ?? null,
        preparation: ingredient.preparation ?? '',
        section: ingredient.section ?? '',
        notes: ingredient.notes ?? '',
        isOptional: ingredient.isOptional,
      }
    : {
        name: '',
        itemId: null,
        quantity: '1',
        unit: '',
        unitId: null,
        preparation: '',
        section: '',
        notes: '',
        isOptional: false,
      };
