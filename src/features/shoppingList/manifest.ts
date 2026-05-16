import type { FeatureManifest } from '../types';
import { ShoppingListStack } from '#navigation/stacks/ShoppingListStack';

export const shoppingListFeature: FeatureManifest = {
  id: 'shoppingList',
  tab: {
    screenName: 'ShoppingList',
    title: 'navigation.tabs.shoppingList',
    order: 20,
    stack: ShoppingListStack,
  },
};
