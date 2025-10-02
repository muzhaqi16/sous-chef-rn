import React from 'react';
import {useUnistyles} from 'react-native-unistyles';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {Icon} from '#/utils';
import {PantryStack} from './PantryStack';
import {ShoppingListStack} from './ShoppingListStack';
import {ProfileScreen} from '#screens/profile';
import {createAnimatedTabNavigator} from '#components/navigation/AnimatedTabNavigator';

export type HomeTabParamList = {
  Pantry: undefined;
  ShoppingList: undefined;
  Profile: undefined;
};

const { Navigator, Screen } = createAnimatedTabNavigator<HomeTabParamList>();

export const HomeTabs = () => {
  const {theme} = useUnistyles();

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
      options={({route}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'PantryMain';
        return {
          title: 'Pantry',
          tabBarStyle: routeName !== 'PantryMain' ? {display: 'none'} : undefined,
        };
      }}
    />
    <Screen
      name="ShoppingList"
      component={ShoppingListStack}
      options={({route}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'ShoppingListMain';
        return {
          title: 'Shopping List',
          tabBarStyle: routeName !== 'ShoppingListMain' ? {display: 'none'} : undefined,
        };
      }}
    />
    <Screen
      name="Profile"
      component={ProfileScreen}
      options={{title: 'Profile'}}
    />
  </Navigator>
  );
};
