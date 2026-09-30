/**
 * Removing a meal plan or template from the lists that show it.
 */
import { createRemoveFromQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

export const removeFromMealPlans = createRemoveFromQueryConnectionUpdater(
  'mealPlans',
  'MealPlan',
);
export const removeFromMealTemplates = createRemoveFromQueryConnectionUpdater(
  'mealTemplates',
  'MealTemplate',
);
