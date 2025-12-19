import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  PantryMain,
  PantryItemScreen,
  PantryItemDetail,
  ExpiringItems,
  LowStockItems,
  CategoryManagement,
  PantrySettings,
  PantryAnalytics,
  NutritionScreen,
} from '#screens/pantry';

export type PantryStackParamList = {
  PantryMain: undefined;
  PantryItem: {itemId?: string};
  PantryItemDetail: {itemId: string};
  ExpiringItems: undefined;
  LowStockItems: undefined;
  CategoryManagement: undefined;
  PantrySettings: {pantryId?: string};
  PantryAnalytics: {pantryId: string};
  NutritionScreen: {itemId: string; itemName: string; nutritions: unknown; actualServingGrams?: number};
};

const Stack = createNativeStackNavigator<PantryStackParamList>();

export const PantryStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      animationDuration: 250,
      fullScreenGestureEnabled: true,
    }}
  >
    <Stack.Screen name="PantryMain" component={PantryMain} />
    <Stack.Screen name="PantryItem" component={PantryItemScreen} />
    <Stack.Screen name="PantryItemDetail" component={PantryItemDetail} />
    <Stack.Screen name="ExpiringItems" component={ExpiringItems} />
    <Stack.Screen name="LowStockItems" component={LowStockItems} />
    <Stack.Screen name="CategoryManagement" component={CategoryManagement} />
    <Stack.Screen name="PantrySettings" component={PantrySettings} />
    <Stack.Screen name="PantryAnalytics" component={PantryAnalytics} />
    <Stack.Screen name="NutritionScreen" component={NutritionScreen} />
  </Stack.Navigator>
);
