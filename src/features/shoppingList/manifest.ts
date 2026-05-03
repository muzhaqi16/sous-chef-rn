import type { FeatureManifest } from '../types';
import { ShoppingListStack } from '#navigation/stacks/ShoppingListStack';
import { AcceptInvite } from './screens/AcceptInvite';
import { JoinByShareCodeScreen } from './screens/JoinByShareCodeScreen';

export const shoppingListFeature: FeatureManifest = {
  id: 'shoppingList',
  tab: {
    screenName: 'ShoppingList',
    title: 'List',
    order: 20,
    stack: ShoppingListStack,
  },
  deepLinkScreens: {
    AcceptInvitation: {
      screen: AcceptInvite,
      linking: 'accept-invitation',
    },
    JoinByShareCode: {
      screen: JoinByShareCodeScreen,
      linking: 'join-list/:shareCode',
    },
  },
};
