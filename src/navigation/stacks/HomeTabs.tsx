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

// Written as a literal object rather than built from the feature registry —
// react-navigation's static typing only infers per-tab param types from a
// literal `screens` shape, so each tab's stack keeps its own params (a
// dynamically-built object collapses them all to one generic type). Titles
// still read from each feature's manifest, the single source for the i18n key.
export const HomeTabs = createBottomTabNavigator({
  tabBar: props => <FloatingTabBar {...props} />,
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
      options: { title: pantryFeature.tab!.title },
    }),
    ShoppingList: createBottomTabScreen({
      screen: ShoppingListStack,
      options: { title: shoppingListFeature.tab!.title },
    }),
    Recipe: createBottomTabScreen({
      screen: RecipeStack,
      options: { title: recipesFeature.tab!.title },
    }),
    MealPlan: createBottomTabScreen({
      screen: MealPlanStack,
      options: { title: mealPlanFeature.tab!.title },
    }),
  },
});

export type HomeTabsParams = StaticParamList<typeof HomeTabs>;
