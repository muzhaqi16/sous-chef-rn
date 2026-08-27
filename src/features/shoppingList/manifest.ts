import type { FeatureManifest } from '../types';
import { ShoppingListStack } from '#navigation/stacks/ShoppingListStack';

export const shoppingListFeature: FeatureManifest = {
  id: 'shoppingList',
  tab: {
    screenName: 'ShoppingList',
    titleKey: 'navigation.tabs.shoppingList',
    order: 20,
    icon: { active: 'list', inactive: 'list-outline' },
    mainScreen: 'ShoppingListMain',
    stack: ShoppingListStack,
  },
};
