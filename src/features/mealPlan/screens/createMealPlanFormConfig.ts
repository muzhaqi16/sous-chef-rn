import { boolean, date, mixed, object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#/utils/validation/common';
import { MealPlanType } from '#/graphql/generated/schemaTypes';
import { startingServings } from '#domain/servings';

export const PERSONAL_VALUE = '__personal__';

/** A plan's servings when nobody said how many they cook for. */
export const DEFAULT_PLAN_SERVINGS = 2;

export interface CreateMealPlanFormValues {
  name: string;
  description: string;
  planType: MealPlanType;
  startDate: Date | null;
  servings: string;
  budget: string;
  trackNutrition: boolean;
  homeSelection: string;
}

export const createMealPlanSchema: ObjectSchema<CreateMealPlanFormValues> =
  object({
    name: string().trim().required(lazyMessage('mealPlan.nameRequiredMessage')),
    description: string().defined(),
    planType: mixed<MealPlanType>()
      .oneOf(Object.values(MealPlanType))
      .required(),
    startDate: date()
      .nullable()
      .required(lazyMessage('mealPlan.startDateRequiredMessage')),
    servings: string().defined(),
    budget: string().defined(),
    trackNutrition: boolean().defined(),
    homeSelection: string().defined(),
  });

export const createMealPlanDefaults = (
  selectedHomeId: string | null | undefined,
  cooksFor: number | null = null,
): CreateMealPlanFormValues => ({
  name: '',
  description: '',
  planType: MealPlanType.Weekly,
  startDate: new Date(),
  servings: String(startingServings(cooksFor, DEFAULT_PLAN_SERVINGS)),
  budget: '',
  trackNutrition: false,
  homeSelection: selectedHomeId ?? PERSONAL_VALUE,
});
