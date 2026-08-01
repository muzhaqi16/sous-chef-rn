import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { ShoppingListMain } from '#features/shoppingList/screens/ShoppingListMain';
import { ListSettings } from '#features/shoppingList/screens/ListSettings';
import { ShareList } from '#features/shoppingList/screens/ShareList';
import { AddEditItem } from '#features/shoppingList/screens/AddEditItem';
import { ShoppingListItemDetail } from '#features/shoppingList/screens/ItemDetail';
import { PurchaseHistoryScreen } from '#features/shoppingList/screens/PurchaseHistoryScreen';
import { HomeDetailScreen } from '#screens/home/HomeDetailScreen';
import { StorageLocationsScreen } from '#screens/home/StorageLocationsScreen';
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

// Detail/sub screens nested under ShoppingList's own stack, isolating this
// tab's Offscreen-pause boundary from the other 3 tabs (see RootNavigator's
// `Home` comment and PantryStack.tsx). Tab bar visibility is handled the same
// way as Pantry's — derived from navigation state in `FloatingTabBar`.
const detailScreenOptions = {
  fullScreenGestureEnabled: true,
  animationDuration: 250,
};

export const ShoppingListStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    contentStyle: { backgroundColor: theme.colors.background },
    // Confirmed fix (via controlled A/B revert) — see PantryStack.tsx's
    // identical comment and CLAUDE.md's `inactiveBehavior` section.
    inactiveBehavior: 'none',
  }),
  screenLayout: topInsetScreenLayout,
  screens: {
    ShoppingListMain: createNativeStackScreen({
      screen: ShoppingListMain,
      // `:listId?` selects a specific list on open (souschef://shopping/{listId});
      // bare `shopping` opens the last-selected list.
      linking: 'shopping/:listId?',
    }),
    ListSettings: createNativeStackScreen({
      screen: ListSettings,
      options: detailScreenOptions,
      linking: null,
    }),
    ShareList: createNativeStackScreen({
      screen: ShareList,
      options: detailScreenOptions,
      linking: null,
    }),
    // Duplicate registration (also 'AddItem' at root — AddEditItem is shared
    // by both routes, distinguished by route params, not route name).
    EditItem: createNativeStackScreen({
      screen: AddEditItem,
      options: detailScreenOptions,
      linking: null,
    }),
    ItemDetail: createNativeStackScreen({
      screen: ShoppingListItemDetail,
      layout: noInsetScreenLayout,
      options: detailScreenOptions,
      linking: null,
    }),
    PurchaseHistory: createNativeStackScreen({
      screen: PurchaseHistoryScreen,
      options: detailScreenOptions,
      linking: null,
    }),
    // Duplicate registration (also nested in PantryStack) — ShareList/
    // ListSettings above are its only callers, both now nested here.
    HomeDetail: createNativeStackScreen({
      screen: HomeDetailScreen,
      options: {
        presentation: 'card',
        animation: 'slide_from_right',
      },
      linking: null,
    }),
    // Duplicate registration (also nested in PantryStack) — only ever
    // reached from wherever HomeDetail itself is currently rendered.
    StorageLocations: createNativeStackScreen({
      screen: StorageLocationsScreen,
      options: { presentation: 'card', animation: 'slide_from_right' },
      linking: null,
    }),
  },
});

export type ShoppingListStackParams = StaticParamList<typeof ShoppingListStack>;
