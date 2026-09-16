import { mixed, object, string, type ObjectSchema } from 'yup';
import { t, type TranslationKey } from '#/i18n';
import {
  MealType,
  TemplateCategory,
  type MealRefInput,
} from '#/graphql/generated/schemaTypes';

// Messages resolve LAZILY: the schemas are built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: TranslationKey) => (): string => t(key);

/** The template itself. */
export interface TemplateFormValues {
  name: string;
  category: TemplateCategory;
  defaultServings: string;
  description: string;
  tags: string;
}

/** One meal added to the template — its own form, on the same screen. */
export interface TemplateItemFormValues {
  itemDay: string;
  itemMealType: MealType;
  itemName: string;
  /** Empty when the meal is a custom name rather than a saved recipe. */
  itemRecipeId: string;
  itemRecipeName: string;
  itemServings: string;
}

/** The meal an item already holds, as the builder mirrors it. */
export interface ItemMeal {
  recipeId: string | null;
  customMealName: string;
}

export const templateSchema: ObjectSchema<TemplateFormValues> = object({
  name: string()
    .trim()
    .required(msg('mealTemplateBuilder.nameRequiredMessage')),
  category: mixed<TemplateCategory>()
    .oneOf(Object.values(TemplateCategory))
    .required(),
  defaultServings: string().defined(),
  description: string().defined(),
  tags: string().defined(),
});

export const templateItemSchema: ObjectSchema<TemplateItemFormValues> = object({
  itemDay: string().defined(),
  itemMealType: mixed<MealType>().oneOf(Object.values(MealType)).required(),
  // A recipe names the meal itself, so only a custom meal needs a name.
  itemName: string()
    .trim()
    .defined()
    .when('itemRecipeId', {
      is: (recipeId: string) => !recipeId,
      then: schema =>
        schema.required(msg('mealTemplateBuilder.itemNameRequiredMessage')),
    }),
  itemRecipeId: string().defined(),
  itemRecipeName: string().defined(),
  itemServings: string().defined(),
});

export const templateDefaults = (
  category: TemplateCategory,
): TemplateFormValues => ({
  name: '',
  category,
  defaultServings: '2',
  description: '',
  tags: '',
});

export const templateItemDefaults = (
  mealType: MealType,
): TemplateItemFormValues => ({
  itemDay: '0',
  itemMealType: mealType,
  itemName: '',
  itemRecipeId: '',
  itemRecipeName: '',
  itemServings: '2',
});

/** `MealRefInput` is @oneOf: a saved recipe, else the custom name. */
export function mealRefOf(
  values: Pick<TemplateItemFormValues, 'itemRecipeId' | 'itemName'>,
): MealRefInput {
  return values.itemRecipeId
    ? { recipeId: values.itemRecipeId }
    : { customMealName: values.itemName.trim() };
}

/**
 * The ref an item edit sends, or undefined when the meal is unchanged: an
 * omitted `meal` leaves the server's recipe link untouched.
 */
export function changedMealRef(
  original: ItemMeal,
  values: Pick<TemplateItemFormValues, 'itemRecipeId' | 'itemName'>,
): MealRefInput | undefined {
  const next = mealRefOf(values);
  if (next.recipeId) {
    return next.recipeId === original.recipeId ? undefined : next;
  }
  const unchanged =
    !original.recipeId && next.customMealName === original.customMealName;
  return unchanged ? undefined : next;
}
