import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useUnistyles} from 'react-native-unistyles';
import {Icon} from '#/utils';
import {PantryStack} from './PantryStack';
import {ShoppingListStack} from './ShoppingListStack';
import {ProfileScreen} from '#screens/profile';

export type HomeTabParamList = {
  Pantry: undefined;
  ShoppingList: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<HomeTabParamList>();

export const HomeTabs = () => {
  const {theme} = useUnistyles();

  return (
    <Tab.Navigator
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
    <Tab.Screen
      name="Pantry"
      component={PantryStack}
      options={{title: 'Pantry'}}
    />
    <Tab.Screen
      name="ShoppingList"
      component={ShoppingListStack}
      options={{title: 'Shopping List'}}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{title: 'Profile'}}
    />
  </Tab.Navigator>
  );
};
