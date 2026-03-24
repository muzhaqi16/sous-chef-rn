import React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PantryStack } from './PantryStack';
import { ShoppingListStack } from './ShoppingListStack';
import { RecipeStack } from './RecipeStack';
import { MealPlanStack } from './MealPlanStack';
import { TabBarActionsProvider } from '#/context/TabBarActionsContext';
import { FloatingTabBar } from '#components/navigation/FloatingTabBar/FloatingTabBar';

function HomeTabsLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useUnistyles();
  return (
    <TabBarActionsProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {children}
      </View>
    </TabBarActionsProvider>
  );
}

export const HomeTabs = createBottomTabNavigator({
  tabBar: props => <FloatingTabBar {...props} />,
  layout: HomeTabsLayout,
  screenOptions: {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    lazy: true,
    animation: 'none',
  },
  screens: {
    Pantry: {
      screen: PantryStack,
      options: { title: 'Pantry' },
    },
    ShoppingList: {
      screen: ShoppingListStack,
      options: { title: 'List' },
    },
    Recipe: {
      screen: RecipeStack,
      options: { title: 'Recipes' },
    },
    MealPlan: {
      screen: MealPlanStack,
      options: { title: 'Meal Plan' },
    },
  },
});
