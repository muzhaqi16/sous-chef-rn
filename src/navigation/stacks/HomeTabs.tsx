import React from 'react';
import {useUnistyles} from 'react-native-unistyles';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {Icon} from '#/utils';
import {PantryStack} from './PantryStack';
import {ShoppingListStack} from './ShoppingListStack';
import {RecipeStack} from './RecipeStack';
import {ProfileScreen} from '#screens/profile';
import {createAnimatedTabNavigator} from '#components/navigation/AnimatedTabNavigator';

export type HomeTabParamList = {
  Pantry: undefined;
  ShoppingList: undefined;
  Recipe: undefined;
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
            Recipe: ['book', 'book-outline'],
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
          freezeOnBlur: true, // Prevent re-renders when tab is not active
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
          freezeOnBlur: true, // Prevent re-renders when tab is not active
        };
      }}
    />
    <Screen
      name="Recipe"
      component={RecipeStack}
      options={({route}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'RecipeMain';
        return {
          title: 'Recipes',
          tabBarStyle: routeName !== 'RecipeMain' ? {display: 'none'} : undefined,
          freezeOnBlur: true, // Prevent re-renders when tab is not active
        };
      }}
    />
    <Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        title: 'Profile',
        freezeOnBlur: true, // Prevent re-renders when tab is not active
      }}
    />
  </Navigator>
  );
};
