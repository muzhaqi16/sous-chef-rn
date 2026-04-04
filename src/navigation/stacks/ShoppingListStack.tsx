import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { ShoppingListMain } from '#screens/shoppingList/ShoppingListMain';
import { ListSettings } from '#screens/shoppingList/ListSettings';
import { ShareList } from '#screens/shoppingList/ShareList';
import { AddEditItem } from '#screens/shoppingList/AddEditItem';
import { ShoppingListItemDetail } from '#screens/shoppingList/ItemDetail';
import { PurchaseHistoryScreen } from '#screens/shoppingList/PurchaseHistoryScreen';

export const ShoppingListStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: {
    ShoppingListMain: createNativeStackScreen({
      screen: ShoppingListMain,
      linking: 'shopping',
    }),
    ListSettings: ListSettings,
    ShareList: ShareList,
    AddItem: createNativeStackScreen({
      screen: AddEditItem,
      linking: 'shopping/add',
    }),
    EditItem: createNativeStackScreen({
      screen: AddEditItem,
      linking: 'shopping/edit/:itemId',
    }),
    ItemDetail: ShoppingListItemDetail,
    PurchaseHistory: PurchaseHistoryScreen,
  },
});

export type ShoppingListStackParams = StaticParamList<typeof ShoppingListStack>;
