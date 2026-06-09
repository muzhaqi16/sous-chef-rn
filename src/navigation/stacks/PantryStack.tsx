import React from 'react';
import type { StaticParamList } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { PantryMain } from '#features/pantry/screens/PantryMain';
import { PantryItemScreen } from '#features/pantry/screens/PantryItemScreen';
import { PantryItemDetail } from '#features/pantry/screens/PantryItemDetail';
import { FilteredPantryItems } from '#features/pantry/screens/FilteredPantryItems';
import { PantrySettings } from '#features/pantry/screens/PantrySettings';
import { NutritionScreen } from '#features/pantry/screens/NutritionScreen';
import { RecipeDetail } from '#features/recipes/screens/RecipeDetail';
import { topInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';

// Lazy-load PantryAnalytics to defer Skia + victory-native JS loading
const PantryAnalytics = React.lazy(() =>
  import('#features/pantry/screens/PantryAnalytics').then(m => ({
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
    inactiveBehavior: 'none',
  }),
  // Top safe-area inset is applied per screen (no longer global — see
  // TopInsetLayout). Every screen gets it EXCEPT RecipeDetail, which draws its
  // hero image edge-to-edge behind the status bar.
  screens: {
    PantryMain: createNativeStackScreen({
      screen: PantryMain,
      linking: 'pantry',
      layout: topInsetScreenLayout,
    }),
    PantryItem: createNativeStackScreen({
      screen: PantryItemScreen,
      linking: 'pantry/item/:itemId?',
      layout: topInsetScreenLayout,
    }),
    // No top-inset layout: like RecipeDetail, this screen draws its hero image
    // edge-to-edge behind the status bar and applies insets itself.
    PantryItemDetail: createNativeStackScreen({
      screen: PantryItemDetail,
      linking: 'pantry/detail/:itemId',
    }),
    FilteredPantryItems: createNativeStackScreen({
      screen: FilteredPantryItems,
      layout: topInsetScreenLayout,
    }),
    PantrySettings: createNativeStackScreen({
      screen: PantrySettings,
      linking: 'pantry/settings',
      layout: topInsetScreenLayout,
    }),
    PantryAnalytics: createNativeStackScreen({
      screen: PantryAnalytics,
      layout: topInsetScreenLayout,
    }),
    NutritionScreen: createNativeStackScreen({
      screen: NutritionScreen,
      layout: topInsetScreenLayout,
    }),
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
    }),
  },
});

export type PantryStackParams = StaticParamList<typeof PantryStack>;
