import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { PantryMain } from '#screens/pantry/PantryMain';
import { PantryItemScreen } from '#screens/pantry/PantryItemScreen';
import { PantryItemDetail } from '#screens/pantry/PantryItemDetail';
import { LowStockItems } from '#screens/pantry/LowStockItems';
import { CategoryManagement } from '#screens/pantry/CategoryManagement';
import { PantrySettings } from '#screens/pantry/PantrySettings';
import { PantryAnalytics } from '#screens/pantry/PantryAnalytics';
import { NutritionScreen } from '#screens/pantry/NutritionScreen';
import { RecipeDetail } from '#screens/recipe/RecipeDetail';

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

export const PantryStack = React.memo(() => (
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
));
