import React from 'react';
import { createNativeStackScreen } from '@react-navigation/native-stack';
import { noInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';
import { PantryItemScreen } from './PantryItemScreen';
import { PantryItemDetail } from './PantryItemDetail';
import { FilteredPantryItems } from './FilteredPantryItems';
import { PantrySettings } from './PantrySettings';
import { NutritionScreen } from './NutritionScreen';
import { PantryBatchHistoryScreen } from './PantryBatchHistoryScreen';
import { PantryUsageHistoryScreen } from './PantryUsageHistoryScreen';

// Lazy so Skia + victory-native are not in the startup bundle.
const PantryAnalytics = React.lazy(() =>
  import('./PantryAnalytics').then(m => ({ default: m.PantryAnalytics })),
);

const detailScreenOptions = {
  fullScreenGestureEnabled: true,
  animationDuration: 250,
};

/**
 * Spread into RootNavigator's `MainApp` group as siblings of `Home`, not nested in
 * the Pantry tab: the pushed screen covers the tab navigator, so the tab bar is
 * structurally absent. Keep it a plain object literal — that preserves
 * `StaticParamList` inference. `linking: null` opts each out of `'auto'` linking.
 */
export const pantryDetailScreens = {
  PantryItem: createNativeStackScreen({
    screen: PantryItemScreen,
    options: detailScreenOptions,
    linking: null,
  }),
  PantryItemDetail: createNativeStackScreen({
    screen: PantryItemDetail,
    // Hero screen — draws edge-to-edge, so it opts out of the top inset.
    layout: noInsetScreenLayout,
    options: detailScreenOptions,
    linking: null,
  }),
  FilteredPantryItems: createNativeStackScreen({
    screen: FilteredPantryItems,
    options: detailScreenOptions,
    linking: null,
  }),
  PantrySettings: createNativeStackScreen({
    screen: PantrySettings,
    options: detailScreenOptions,
    linking: null,
  }),
  PantryAnalytics: createNativeStackScreen({
    screen: PantryAnalytics,
    options: detailScreenOptions,
    linking: null,
  }),
  NutritionScreen: createNativeStackScreen({
    screen: NutritionScreen,
    options: detailScreenOptions,
    linking: null,
  }),
  PantryBatchHistory: createNativeStackScreen({
    screen: PantryBatchHistoryScreen,
    options: detailScreenOptions,
    linking: null,
  }),
  PantryUsageHistory: createNativeStackScreen({
    screen: PantryUsageHistoryScreen,
    options: detailScreenOptions,
    linking: null,
  }),
};
