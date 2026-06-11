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
import {
  topInsetScreenLayout,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';

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
  // Top safe-area inset is the stack-wide default; immersive hero screens
  // (PantryItemDetail, RecipeDetail) opt out to draw edge-to-edge behind the
  // status bar and inset themselves.
  screenLayout: topInsetScreenLayout,
  screens: {
    PantryMain: createNativeStackScreen({
      screen: PantryMain,
      linking: 'pantry',
    }),
    PantryItem: createNativeStackScreen({
      screen: PantryItemScreen,
      linking: 'pantry/item/:itemId?',
    }),
    PantryItemDetail: createNativeStackScreen({
      screen: PantryItemDetail,
      linking: 'pantry/detail/:itemId',
      layout: noInsetScreenLayout,
    }),
    FilteredPantryItems: createNativeStackScreen({
      screen: FilteredPantryItems,
    }),
    PantrySettings: createNativeStackScreen({
      screen: PantrySettings,
      linking: 'pantry/settings',
    }),
    PantryAnalytics: createNativeStackScreen({
      screen: PantryAnalytics,
    }),
    NutritionScreen: createNativeStackScreen({
      screen: NutritionScreen,
    }),
    RecipeDetail: createNativeStackScreen({
      screen: RecipeDetail,
      layout: noInsetScreenLayout,
    }),
  },
});

export type PantryStackParams = StaticParamList<typeof PantryStack>;
