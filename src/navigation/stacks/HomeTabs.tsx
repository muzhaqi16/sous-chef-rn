import React from 'react';
import { View } from 'react-native';
import type { StaticParamList } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import {
  createBottomTabNavigator,
  createBottomTabScreen,
} from '@react-navigation/bottom-tabs';
import { pantryFeature } from '#features/pantry/manifest';
import { shoppingListFeature } from '#features/shoppingList/manifest';
import { recipesFeature } from '#features/recipes/manifest';
import { mealPlanFeature } from '#features/mealPlan/manifest';
import { TAB_APPEARANCE } from '#features/registry';
import { PantryStack } from '#navigation/stacks/PantryStack';
import { ShoppingListStack } from '#navigation/stacks/ShoppingListStack';
import { RecipeStack } from '#navigation/stacks/RecipeStack';
import { MealPlanStack } from '#navigation/stacks/MealPlanStack';
import { TabBarActionsProvider } from '#/context/TabBarActionsContext';
import { FloatingTabBar } from '#components/navigation/FloatingTabBar/FloatingTabBar';

function HomeTabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabBarActionsProvider>
      <View style={styles.layout}>{children}</View>
    </TabBarActionsProvider>
  );
}

const styles = StyleSheet.create(theme => ({
  layout: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

// `screens` is a literal rather than a map built from the registry:
// react-navigation's static typing only infers per-tab param types from a
// literal shape, and a dynamically-built object collapses all four stacks to
// one generic type. Everything ELSE about a tab — its label key, icons, sort
// order and reset-to-root target — comes from the owning feature's manifest.
//
// The literal is therefore the one place the registry cannot reach, so
// `__tests__/HomeTabs.test.tsx` asserts its key set equals
// `TAB_FEATURES.map(f => f.tab.screenName)`. Types force the duplication; the
// test forbids the drift.
//
// `TAB_APPEARANCE` is passed DOWN to the tab bar because `FloatingTabBar` and
// `TabItem` live in `src/components/` — the kit — and must not import a
// feature. This file is the composition root and the only place that may.
export const HomeTabs = createBottomTabNavigator({
  tabBar: props => <FloatingTabBar {...props} tabs={TAB_APPEARANCE} />,
  layout: HomeTabsLayout,
  screenOptions: {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    lazy: true,
    // Crossfade between tabs instead of an instant cut. This is the most
    // repeated transition in the app; a hard swap reads as cheap.
    animation: 'fade',
    // Keeps a blurred tab's effects (queries, animations) running instead of
    // tearing them down and re-running them all synchronously on resume —
    // see CLAUDE.md's `inactiveBehavior` section.
    inactiveBehavior: 'none',
  },
  screens: {
    Pantry: createBottomTabScreen({
      screen: PantryStack,
      options: { title: pantryFeature.tab!.titleKey },
    }),
    ShoppingList: createBottomTabScreen({
      screen: ShoppingListStack,
      options: { title: shoppingListFeature.tab!.titleKey },
    }),
    Recipe: createBottomTabScreen({
      screen: RecipeStack,
      options: { title: recipesFeature.tab!.titleKey },
    }),
    MealPlan: createBottomTabScreen({
      screen: MealPlanStack,
      options: { title: mealPlanFeature.tab!.titleKey },
    }),
  },
});

export type HomeTabsParams = StaticParamList<typeof HomeTabs>;
