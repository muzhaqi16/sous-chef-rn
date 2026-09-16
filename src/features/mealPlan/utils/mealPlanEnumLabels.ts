/**
 * The copy for each meal-plan enum, keyed by the enum so a member the schema
 * gains fails to compile until it is labelled. Keys, not strings: resolving at
 * module load would freeze the first-loaded language.
 */
import {
  MealPlanType,
  MealType,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import type { TranslationKey } from '#/i18n';

export const MEAL_TYPE_LABEL_KEYS: Record<MealType, TranslationKey> = {
  [MealType.Breakfast]: 'labels.breakfast',
  [MealType.Brunch]: 'labels.brunch',
  [MealType.Lunch]: 'labels.lunch',
  [MealType.Snack]: 'usagePurpose.SNACK',
  [MealType.Dinner]: 'labels.dinner',
  [MealType.Dessert]: 'labels.dessert',
};

export const TEMPLATE_CATEGORY_LABEL_KEYS: Record<
  TemplateCategory,
  TranslationKey
> = {
  [TemplateCategory.Weekly]: 'saveAsTemplate.categoryWeekly',
  [TemplateCategory.Monthly]: 'saveAsTemplate.categoryMonthly',
  [TemplateCategory.Breakfast]: 'labels.breakfast',
  [TemplateCategory.Lunch]: 'labels.lunch',
  [TemplateCategory.Dinner]: 'labels.dinner',
  [TemplateCategory.Holiday]: 'saveAsTemplate.categoryHoliday',
  [TemplateCategory.SpecialDiet]: 'saveAsTemplate.categorySpecialDiet',
  [TemplateCategory.Custom]: 'saveAsTemplate.categoryCustom',
};

export const MEAL_PLAN_TYPE_LABEL_KEYS: Record<MealPlanType, TranslationKey> = {
  [MealPlanType.Daily]: 'mealPlan.daily',
  [MealPlanType.Weekly]: 'mealPlan.weekly',
  [MealPlanType.Monthly]: 'mealPlan.monthly',
  [MealPlanType.Custom]: 'mealPlan.custom',
};
