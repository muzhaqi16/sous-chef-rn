import type { FeatureManifest } from '../types';
import { MealPlanStack } from '#navigation/stacks/MealPlanStack';

export const mealPlanFeature: FeatureManifest = {
  id: 'mealPlan',
  tab: {
    screenName: 'MealPlan',
    title: 'navigation.tabs.mealPlan',
    order: 40,
    stack: MealPlanStack,
  },
};
