import React from 'react';
import { View } from 'react-native';
import type { StaticParamList } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import {
  createBottomTabNavigator,
  createBottomTabScreen,
} from '@react-navigation/bottom-tabs';
import { TAB_APPEARANCE } from '#features/registry';
import { PantryStack } from '#navigation/stacks/PantryStack';
import { TodayStack } from '#navigation/stacks/TodayStack';
import { ShoppingListStack } from '#navigation/stacks/ShoppingListStack';
import { RecipeStack } from '#navigation/stacks/RecipeStack';
import { MealPlanStack } from '#navigation/stacks/MealPlanStack';
import { ApolloProvider, useApolloClient } from '@apollo/client/react';
import { TabBarActionsProvider } from '#/context/TabBarActionsContext';
import { FloatingTabBar } from '#app/FloatingTabBar/FloatingTabBar';
import { scopedClient } from '#/apollo/scopedClient';

function HomeTabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabBarActionsProvider>
      <View style={styles.layout}>{children}</View>
    </TabBarActionsProvider>
  );
}

// A hidden tab stays mounted, so its queries stay active. Scoped to the tab, a
// resync leaves them until the tab is shown again (`homeTabOnScreen`).
function TabQueryScope({
  tab,
  children,
}: {
  tab: string;
  children: React.ReactNode;
}) {
  const client = useApolloClient();
  return (
    <ApolloProvider client={scopedClient(client, tab)}>
      {children}
    </ApolloProvider>
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
  screenLayout: ({ children, route }) => (
    <TabQueryScope tab={route.name}>{children}</TabQueryScope>
  ),
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
    Today: createBottomTabScreen({ screen: TodayStack }),
    Pantry: createBottomTabScreen({ screen: PantryStack }),
    ShoppingList: createBottomTabScreen({ screen: ShoppingListStack }),
    Recipe: createBottomTabScreen({ screen: RecipeStack }),
    MealPlan: createBottomTabScreen({ screen: MealPlanStack }),
  },
});

export type HomeTabsParams = StaticParamList<typeof HomeTabs>;
