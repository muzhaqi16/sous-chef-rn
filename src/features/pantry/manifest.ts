import type { FeatureManifest } from '../types';
import { PantryStack } from '#navigation/stacks/PantryStack';

export const pantryFeature: FeatureManifest = {
  id: 'pantry',
  tab: {
    screenName: 'Pantry',
    titleKey: 'navigation.tabs.pantry',
    order: 10,
    icon: { active: 'home', inactive: 'home-outline' },
    mainScreen: 'PantryMain',
    stack: PantryStack,
  },
};
