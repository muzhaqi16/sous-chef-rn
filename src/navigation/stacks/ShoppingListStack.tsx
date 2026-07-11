import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { ShoppingListMain } from '#features/shoppingList/screens/ShoppingListMain';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Single-screen stack: the Shopping List tab's main screen. All detail/sub
// screens (ItemDetail, ListSettings, AddItem, …) are registered at the root
// level in RootNavigator — as siblings of the tab navigator — so the floating
// tab bar is never mounted on them and cannot get stuck hidden.
export const ShoppingListStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screenLayout: topInsetScreenLayout,
  screens: {
    ShoppingListMain: createNativeStackScreen({
      screen: ShoppingListMain,
      // `:listId?` selects a specific list on open (souschef://shopping/{listId});
      // bare `shopping` opens the last-selected list.
      linking: 'shopping/:listId?',
    }),
  },
});

export type ShoppingListStackParams = StaticParamList<typeof ShoppingListStack>;
