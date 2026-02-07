import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { RecipeMain } from '#screens/recipe/RecipeMain';
import { RecipeDetail } from '#screens/recipe/RecipeDetail';
import { RecipeSearch } from '#screens/recipe/RecipeSearch';

export type RecipeStackParamList = {
  RecipeMain: undefined;
  RecipeDetail: {
    recipeId?: string;         // Backend-saved recipe ID
    externalSource?: string;   // External source (SPOONACULAR, EDAMAM, TASTY, etc.)
    externalId?: string;       // External recipe ID
    sourceTab?: 'Pantry' | 'ShoppingList' | 'Recipe';  // Source tab for cross-tab navigation
    sourcePantryItemId?: string;  // Source pantry item ID for back navigation
  };
  RecipeSearch: {ingredients?: string[]};
};

const Stack = createNativeStackNavigator<RecipeStackParamList>();

export const RecipeStack = React.memo(() => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
      animationDuration: 250,
      fullScreenGestureEnabled: true,
    }}
  >
    <Stack.Screen name="RecipeMain" component={RecipeMain} />
    <Stack.Screen name="RecipeDetail" component={RecipeDetail} />
    <Stack.Screen name="RecipeSearch" component={RecipeSearch} />
  </Stack.Navigator>
));
