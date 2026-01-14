import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  PantryMain,
  PantryItemScreen,
  PantryItemDetail,
  LowStockItems,
  CategoryManagement,
  PantrySettings,
  PantryAnalytics,
  NutritionScreen,
} from '#screens/pantry';
import {RecipeDetail} from '#screens/recipe';

export type PantryStackParamList = {
  PantryMain: undefined;
  PantryItem: {itemId?: string};
  PantryItemDetail: {itemId: string};
  LowStockItems: undefined;
  CategoryManagement: undefined;
  PantrySettings: {pantryId?: string};
  PantryAnalytics: {pantryId: string};
  NutritionScreen: {itemId: string; itemName: string; nutritions: unknown; actualServingGrams?: number};
  RecipeDetail: {
    recipeId?: string;
    externalSource?: string;
    externalId?: string;
  };
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
    <Stack.Screen name="LowStockItems" component={LowStockItems} />
    <Stack.Screen name="CategoryManagement" component={CategoryManagement} />
    <Stack.Screen name="PantrySettings" component={PantrySettings} />
    <Stack.Screen name="PantryAnalytics" component={PantryAnalytics} />
    <Stack.Screen name="NutritionScreen" component={NutritionScreen} />
    <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
  </Stack.Navigator>
);
