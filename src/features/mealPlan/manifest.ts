import type { FeatureManifest } from '../types';
import { MealPlanStack } from '#navigation/stacks/MealPlanStack';

export const mealPlanFeature: FeatureManifest = {
  id: 'mealPlan',
  tab: {
    screenName: 'MealPlan',
    // `labels.mealPlan` for the same reason as recipes — see that manifest.
    titleKey: 'labels.mealPlan',
    order: 40,
    icon: { active: 'calendar', inactive: 'calendar-outline' },
    mainScreen: 'MealPlanMain',
    stack: MealPlanStack,
  },
};
