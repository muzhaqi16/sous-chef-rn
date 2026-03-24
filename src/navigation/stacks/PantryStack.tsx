import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PantryMain } from '#screens/pantry/PantryMain';
import { PantryItemScreen } from '#screens/pantry/PantryItemScreen';
import { PantryItemDetail } from '#screens/pantry/PantryItemDetail';
import { FilteredPantryItems } from '#screens/pantry/FilteredPantryItems';
import { PantrySettings } from '#screens/pantry/PantrySettings';
import { NutritionScreen } from '#screens/pantry/NutritionScreen';
import { RecipeDetail } from '#screens/recipe/RecipeDetail';

// Lazy-load PantryAnalytics to defer Skia + victory-native JS loading
const PantryAnalytics = React.lazy(() =>
  import('#screens/pantry/PantryAnalytics').then(m => ({
    default: m.PantryAnalytics,
  })),
);

export const PantryStack = createNativeStackNavigator({
  screenOptions: ({ theme }) => ({
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: theme.colors.background },
  }),
  screens: {
    PantryMain: {
      screen: PantryMain,
      linking: 'pantry',
    },
    PantryItem: {
      screen: PantryItemScreen,
      linking: 'pantry/item/:itemId?',
    },
    PantryItemDetail: {
      screen: PantryItemDetail,
      linking: 'pantry/detail/:itemId',
    },
    FilteredPantryItems: FilteredPantryItems,
    PantrySettings: PantrySettings,
    PantryAnalytics: PantryAnalytics,
    NutritionScreen: NutritionScreen,
    RecipeDetail: RecipeDetail,
  },
});
