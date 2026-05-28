import type { FeatureManifest } from '../types';
import { RecipeStack } from '#navigation/stacks/RecipeStack';

export const recipesFeature: FeatureManifest = {
  id: 'recipes',
  tab: {
    screenName: 'Recipe',
    title: 'navigation.tabs.recipes',
    order: 30,
    stack: RecipeStack,
  },
};
