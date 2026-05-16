import type { FeatureManifest } from '../types';
import { PantryStack } from '#navigation/stacks/PantryStack';

export const pantryFeature: FeatureManifest = {
  id: 'pantry',
  tab: {
    screenName: 'Pantry',
    title: 'navigation.tabs.pantry',
    order: 10,
    stack: PantryStack,
  },
};
