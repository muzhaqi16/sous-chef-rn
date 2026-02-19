import React from 'react';
import { View } from 'react-native';
import {useUnistyles} from 'react-native-unistyles';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {PantryStack} from './PantryStack';
import {ShoppingListStack} from './ShoppingListStack';
import {RecipeStack} from './RecipeStack';
import {MealPlanStack} from './MealPlanStack';
import {TabBarActionsProvider} from '#/context/TabBarActionsContext';
import {FloatingTabBar} from '#components/navigation/FloatingTabBar/FloatingTabBar';

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
  implementation: 'custom',
  detachInactiveScreens: false,
  tabBar: (props) => <FloatingTabBar {...props} />,
  layout: HomeTabsLayout,
  screenOptions: {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    lazy: true,
    freezeOnBlur: true,
    animation: 'fade',
  },
  screens: {
    Pantry: {
      screen: PantryStack,
      options: ({route}: {route: any}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'PantryMain';
        return {
          title: 'Pantry',
          tabBarStyle: routeName !== 'PantryMain' ? {display: 'none' as const} : undefined,
        };
      },
    },
    ShoppingList: {
      screen: ShoppingListStack,
      options: ({route}: {route: any}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'ShoppingListMain';
        return {
          title: 'List',
          tabBarStyle: routeName !== 'ShoppingListMain' ? {display: 'none' as const} : undefined,
        };
      },
    },
    Recipe: {
      screen: RecipeStack,
      options: ({route}: {route: any}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'RecipeMain';
        return {
          title: 'Recipes',
          tabBarStyle: routeName !== 'RecipeMain' ? {display: 'none' as const} : undefined,
        };
      },
    },
    MealPlan: {
      screen: MealPlanStack,
      options: ({route}: {route: any}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'MealPlanMain';
        return {
          title: 'Meal Plan',
          tabBarStyle: routeName !== 'MealPlanMain' ? {display: 'none' as const} : undefined,
        };
      },
    },
  },
});
