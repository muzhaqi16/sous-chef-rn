import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  ShoppingListMain,
  ListSettings,
  ShareList,
  AddEditItem,
  ShoppingListItemDetail,
} from '#screens/shoppingList';

export type ShoppingListStackParamList = {
  ShoppingListMain: undefined;
  ListSettings: {listId?: string};
  ShareList: {listId: string};
  AddItem: {listId: string};
  EditItem: {listId: string; itemId: string};
  ItemDetail: {listId: string; itemId: string};
};

const Stack = createNativeStackNavigator<ShoppingListStackParamList>();

export const ShoppingListStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="ShoppingListMain" component={ShoppingListMain} />
    <Stack.Screen name="ListSettings" component={ListSettings} />
    <Stack.Screen name="ShareList" component={ShareList} />
    <Stack.Screen name="AddItem" component={AddEditItem} />
    <Stack.Screen name="EditItem" component={AddEditItem} />
    <Stack.Screen name="ItemDetail" component={ShoppingListItemDetail} />
  </Stack.Navigator>
);
