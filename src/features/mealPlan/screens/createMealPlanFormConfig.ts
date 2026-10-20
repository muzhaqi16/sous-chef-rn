import { boolean, date, mixed, object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#/utils/validation/common';
import { MealPlanType } from '#/graphql/generated/schemaTypes';

export const PERSONAL_VALUE = '__personal__';

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
): CreateMealPlanFormValues => ({
  name: '',
  description: '',
  planType: MealPlanType.Weekly,
  startDate: new Date(),
  servings: '2',
  budget: '',
  trackNutrition: false,
  homeSelection: selectedHomeId ?? PERSONAL_VALUE,
});
