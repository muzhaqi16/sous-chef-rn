import React from 'react';
import {useUnistyles} from 'react-native-unistyles';
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
      options={{title: 'Pantry'}}
    />
    <Screen
      name="ShoppingList"
      component={ShoppingListStack}
      options={{title: 'Shopping List'}}
    />
    <Screen
      name="Profile"
      component={ProfileScreen}
      options={{title: 'Profile'}}
    />
  </Navigator>
  );
};
