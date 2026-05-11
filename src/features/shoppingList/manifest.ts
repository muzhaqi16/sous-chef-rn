import type { FeatureManifest } from '../types';
import { ShoppingListStack } from '#navigation/stacks/ShoppingListStack';

export const shoppingListFeature: FeatureManifest = {
  id: 'shoppingList',
  tab: {
    screenName: 'ShoppingList',
    title: 'List',
    order: 20,
    stack: ShoppingListStack,
  },
};
