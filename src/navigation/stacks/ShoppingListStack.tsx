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

export const ShoppingListStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
    inactiveBehavior: 'none',
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
