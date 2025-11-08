import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  ShoppingListMain,
  ListSettings,
  ShareList,
  AddEditItem,
  ShoppingListItemDetail,
  PurchaseHistoryScreen,
} from '#screens/shoppingList';

export type ShoppingListStackParamList = {
  ShoppingListMain: undefined;
  ListSettings: {listId?: string};
  ShareList: {listId: string};
  AddItem: {listId: string};
  EditItem: {listId: string; itemId: string};
  ItemDetail: {listId: string; itemId: string};
  PurchaseHistory: {
    itemId: string;
    itemName: string;
    purchases: Array<{
      id: string;
      purchaseDate: string;
      quantity: number;
      unitSymbol: string;
      user?: {
        id: string;
        email: string;
        profile?: {
          displayName?: string;
        };
      };
    }>;
  };
};

const Stack = createNativeStackNavigator<ShoppingListStackParamList>();

export const ShoppingListStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      animationDuration: 250,
      fullScreenGestureEnabled: true,
    }}
  >
    <Stack.Screen name="ShoppingListMain" component={ShoppingListMain} />
    <Stack.Screen name="ListSettings" component={ListSettings} />
    <Stack.Screen name="ShareList" component={ShareList} />
    <Stack.Screen name="AddItem" component={AddEditItem} />
    <Stack.Screen name="EditItem" component={AddEditItem} />
    <Stack.Screen name="ItemDetail" component={ShoppingListItemDetail} />
    <Stack.Screen name="PurchaseHistory" component={PurchaseHistoryScreen} />
  </Stack.Navigator>
);
