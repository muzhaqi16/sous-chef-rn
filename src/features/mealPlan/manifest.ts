import type { FeatureManifest } from '../types';
import { MealPlanStack } from '#navigation/stacks/MealPlanStack';

export const mealPlanFeature: FeatureManifest = {
  id: 'mealPlan',
  tab: {
    screenName: 'MealPlan',
    title: 'Meal Plan',
    order: 40,
    stack: MealPlanStack,
  },
};
