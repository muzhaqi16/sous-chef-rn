import type { FeatureManifest } from '../types';
import { PantryStack } from '#navigation/stacks/PantryStack';

export const pantryFeature: FeatureManifest = {
  id: 'pantry',
  tab: {
    screenName: 'Pantry',
    title: 'Pantry',
    order: 10,
    stack: PantryStack,
  },
};
