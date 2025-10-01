import React from 'react';
import {useUnistyles} from 'react-native-unistyles';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {Icon} from '#/utils';
import {PantryStack} from './PantryStack';
import {ShoppingListStack} from './ShoppingListStack';
import {ProfileScreen} from '#screens/profile';
import {createAnimatedTabNavigator} from '#components/navigation/AnimatedTabNavigator';
import {useTabBarVisibility} from '#/context/TabBarVisibilityContext';

export type HomeTabParamList = {
  Pantry: undefined;
  ShoppingList: undefined;
  Profile: undefined;
};

const { Navigator, Screen } = createAnimatedTabNavigator<HomeTabParamList>();

export const HomeTabs = () => {
  const {theme} = useUnistyles();
  const {hideTabBar, showTabBar} = useTabBarVisibility();

  return (
    <Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarIcon: ({focused, color, size}) => {
          const iconMap: Record<string, [string, string]> = {
            Pantry: ['home', 'home-outline'],
            ShoppingList: ['list', 'list-outline'],
            Profile: ['person', 'person-outline'],
          };

          const [activeIcon, inactiveIcon] = iconMap[route.name] || [
            'help-circle',
            'help-circle',
          ];

          return (
            <Icon
              library="Ionicons"
              name={focused ? activeIcon : inactiveIcon}
              size={size}
              color={color}
            />
          );
        },
      })}>
    <Screen
      name="Pantry"
      component={PantryStack}
      options={{title: 'Pantry'}}
      listeners={({route}) => ({
        state: () => {
          // Get the current route name within the Pantry stack
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'PantryMain';

          // Show tab bar only on PantryMain, hide on all detail screens
          if (routeName === 'PantryMain') {
            showTabBar('navigation');
          } else {
            hideTabBar('navigation');
          }
        },
      })}
    />
    <Screen
      name="ShoppingList"
      component={ShoppingListStack}
      options={{title: 'Shopping List'}}
      listeners={({route}) => ({
        state: () => {
          // Get the current route name within the ShoppingList stack
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'ShoppingListMain';

          // Show tab bar only on ShoppingListMain, hide on all detail screens
          if (routeName === 'ShoppingListMain') {
            showTabBar('navigation');
            showTabBar('scroll'); // Also clear scroll reason when returning to main
          } else {
            hideTabBar('navigation');
          }
        },
        focus: () => {
          // Also check on focus to ensure it updates when switching tabs
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'ShoppingListMain';
          if (routeName === 'ShoppingListMain') {
            showTabBar('navigation');
            showTabBar('scroll'); // Also clear scroll reason when returning to main
          } else {
            hideTabBar('navigation');
          }
        },
      })}
    />
    <Screen
      name="Profile"
      component={ProfileScreen}
      options={{title: 'Profile'}}
      listeners={() => ({
        focus: () => {
          // Always show tab bar on Profile screen
          showTabBar('navigation');
        },
      })}
    />
  </Navigator>
  );
};
