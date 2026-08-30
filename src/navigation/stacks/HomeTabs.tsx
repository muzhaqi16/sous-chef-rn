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

// A literal, not a map built from the registry: react-navigation infers per-tab
// param types only from a literal shape, and a dynamic object collapses all four
// stacks to one generic type. Everything else about a tab comes from its
// feature's manifest, and `HomeTabs.test.tsx` asserts this key set matches
// `TAB_FEATURES`. `TAB_APPEARANCE` is passed DOWN because `FloatingTabBar` is kit
// code and must not import a feature; this file is the composition root.
export const HomeTabs = createBottomTabNavigator({
  tabBar: props => <FloatingTabBar {...props} tabs={TAB_APPEARANCE} />,
  layout: HomeTabsLayout,
  screenOptions: {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    lazy: true,
    // The most repeated transition in the app; a hard swap reads as cheap.
    animation: 'fade',
    // Keeps a blurred tab's queries and animations running rather than re-running
    // every effect synchronously on resume — see CLAUDE.md `inactiveBehavior`.
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
