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
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

export const ShoppingListStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
    inactiveBehavior: 'none',
  }),
  // Top safe-area inset is the stack-wide default; ItemDetail opts out to
  // draw its hero edge-to-edge behind the status bar and inset itself, same
  // as PantryItemDetail and RecipeDetail.
  screenLayout: topInsetScreenLayout,
  screens: {
    ShoppingListMain: createNativeStackScreen({
      screen: ShoppingListMain,
      // `:listId?` selects a specific list on open (souschef://shopping/{listId});
      // bare `shopping` opens the last-selected list.
      linking: 'shopping/:listId?',
    }),
    // Wrapped without a `linking` key — intentionally not deep-linkable;
    // reachable only from within the shopping list flow.
    ListSettings: createNativeStackScreen({
      screen: ListSettings,
    }),
    ShareList: createNativeStackScreen({
      screen: ShareList,
    }),
    AddItem: createNativeStackScreen({
      screen: AddEditItem,
      linking: 'shopping/add',
    }),
    EditItem: createNativeStackScreen({
      screen: AddEditItem,
      linking: 'shopping/edit/:itemId',
    }),
    ItemDetail: createNativeStackScreen({
      screen: ShoppingListItemDetail,
      layout: noInsetScreenLayout,
    }),
    PurchaseHistory: createNativeStackScreen({
      screen: PurchaseHistoryScreen,
    }),
  },
});

export type ShoppingListStackParams = StaticParamList<typeof ShoppingListStack>;
