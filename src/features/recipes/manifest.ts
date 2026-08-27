import type { FeatureManifest } from '../types';
import { RecipeStack } from '#navigation/stacks/RecipeStack';

export const recipesFeature: FeatureManifest = {
  id: 'recipes',
  tab: {
    screenName: 'Recipe',
    // `labels.recipes`, not `navigation.tabs.recipes`: the tab namespace exists
    // for labels that must be SHORTER than the canonical noun (shoppingList is
    // "List" there, "Shopping List" in labels). Recipes needs no short form, and
    // adding one would duplicate a canonical string —
    // `__tests__/i18n/canonicalVocabulary.test.ts` rejects that without a
    // per-locale grammatical reason, which this does not have.
    titleKey: 'labels.recipes',
    order: 30,
    icon: { active: 'book', inactive: 'book-outline' },
    mainScreen: 'RecipeMain',
    stack: RecipeStack,
  },
};
