import { mixed, object, string, type ObjectSchema } from 'yup';
import { t } from '#/i18n';
import { MealType, TemplateCategory } from '#/graphql/generated/schemaTypes';

// Messages resolve LAZILY: the schemas are built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: string) => (): string => t(key);

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
  itemServings: string;
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
  itemName: string()
    .trim()
    .required(msg('mealTemplateBuilder.itemNameRequiredMessage')),
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
  itemServings: '2',
});
