import React from 'react';
import { View } from 'react-native';
import {useUnistyles} from 'react-native-unistyles';
import {getFocusedRouteNameFromRoute, type RouteProp, type ParamListBase} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

// Helper to get focused route name with proper typing for tab navigator routes
// Tab navigator provides `params: unknown` but getFocusedRouteNameFromRoute expects `params: object`
const getTabRouteName = (route: { params?: unknown; state?: unknown; name: string; key: string }) =>
  getFocusedRouteNameFromRoute(route as RouteProp<ParamListBase>);
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
  detachInactiveScreens: false,
  tabBar: (props) => <FloatingTabBar {...props} />,
  layout: HomeTabsLayout,
  screenOptions: {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    lazy: false,
    freezeOnBlur: true,
    animation: 'none',
  },
  screens: {
    Pantry: {
      screen: PantryStack,
      options: ({route}) => {
        const routeName = getTabRouteName(route) ?? 'PantryMain';
        return {
          title: 'Pantry',
          tabBarStyle: routeName !== 'PantryMain' ? {display: 'none' as const} : undefined,
        };
      },
    },
    ShoppingList: {
      screen: ShoppingListStack,
      options: ({route}) => {
        const routeName = getTabRouteName(route) ?? 'ShoppingListMain';
        return {
          title: 'List',
          tabBarStyle: routeName !== 'ShoppingListMain' ? {display: 'none' as const} : undefined,
        };
      },
    },
    Recipe: {
      screen: RecipeStack,
      options: ({route}) => {
        const routeName = getTabRouteName(route) ?? 'RecipeMain';
        return {
          title: 'Recipes',
          tabBarStyle: routeName !== 'RecipeMain' ? {display: 'none' as const} : undefined,
        };
      },
    },
    MealPlan: {
      screen: MealPlanStack,
      options: ({route}) => {
        const routeName = getTabRouteName(route) ?? 'MealPlanMain';
        return {
          title: 'Meal Plan',
          tabBarStyle: routeName !== 'MealPlanMain' ? {display: 'none' as const} : undefined,
        };
      },
    },
  },
});
