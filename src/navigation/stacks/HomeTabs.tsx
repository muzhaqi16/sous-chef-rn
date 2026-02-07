import React, {useMemo} from 'react';
import {useUnistyles} from 'react-native-unistyles';
import {getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {PantryStack} from './PantryStack';
import {ShoppingListStack} from './ShoppingListStack';
import {RecipeStack} from './RecipeStack';
import {ProfileScreen} from '#screens/profile/ProfileScreen';
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

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textSecondary,
    }),
    [theme.colors.primary, theme.colors.textSecondary],
  );

  return (
    <Navigator
      screenOptions={screenOptions}>
    <Screen
      name="Pantry"
      component={PantryStack}
      options={({route}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'PantryMain';
        return {
          title: 'Pantry',
          tabBarStyle: routeName !== 'PantryMain' ? {display: 'none' as const} : undefined,
        };
      }}
    />
    <Screen
      name="ShoppingList"
      component={ShoppingListStack}
      options={({route}) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? 'ShoppingListMain';
        return {
          title: 'List',
          tabBarStyle: routeName !== 'ShoppingListMain' ? {display: 'none' as const} : undefined,
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
          tabBarStyle: routeName !== 'RecipeMain' ? {display: 'none' as const} : undefined,
        };
      }}
    />
    <Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        title: 'Profile',
      }}
    />
  </Navigator>
  );
};
