import React from 'react';
import { createNativeStackScreen } from '@react-navigation/native-stack';
import { noInsetScreenLayout } from '#navigation/layouts/TopInsetLayout';
import { PantryItemScreen } from './PantryItemScreen';
import { PantryItemDetail } from './PantryItemDetail';
import { FilteredPantryItems } from './FilteredPantryItems';
import { PantrySettings } from './PantrySettings';
import { NutritionScreen } from './NutritionScreen';

// Lazy-load PantryAnalytics to defer Skia + victory-native JS loading.
const PantryAnalytics = React.lazy(() =>
  import('./PantryAnalytics').then(m => ({ default: m.PantryAnalytics })),
);

// Mirrors the per-feature stack options these screens used to inherit
// (full-screen swipe-back + 250ms slide), so their feel is unchanged.
const detailScreenOptions = {
  fullScreenGestureEnabled: true,
  animationDuration: 250,
};

/**
 * Pantry's detail/sub screens, registered as siblings of `Home` (the tab
 * navigator) rather than nested inside the Pantry tab's own stack — see
 * RootNavigator, which spreads this object into its `MainApp` group.
 *
 * Siblings of `Home` is react-navigation's documented shape for "the tab bar
 * must not appear on this screen" (docs: Hiding tab bar in screens). The
 * pushed screen covers the tab navigator, so the bar is structurally absent
 * — there is no visibility rule for a new screen to opt into or forget.
 *
 * Owned by the feature rather than written inline in RootNavigator so adding
 * a pantry screen is a one-line change in this file. A plain object spread
 * preserves react-navigation's `StaticParamList` inference (unlike building
 * the map dynamically from the feature registry, which erases it) — the
 * per-screen param types in `useAppNavigation`'s pantry methods are what
 * prove it: they resolve through `RootStackParamList`.
 *
 * `linking: null` on every screen is required, not decorative. The app passes
 * `linking={{ prefixes }}` with no `enabled`, and react-navigation treats
 * `enabled == null` as `'auto'` (createStaticNavigation.js), so any leaf
 * screen without an explicit opt-out gets a deep-linkable path generated from
 * its route name. These are in-app destinations, never link targets.
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
};
