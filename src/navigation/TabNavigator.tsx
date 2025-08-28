import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import Ionicons from '@react-native-vector-icons/ionicons';

import type {HomeTabParamList} from './types';
import {ProfileScreen} from '#/screens';
import {PantryStack} from './PantryStack';
import {ShoppingListStack} from './ShoppingListStack';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const Tab = createBottomTabNavigator<HomeTabParamList>();

const HomeTab = () => {
  const {theme} = useUnistyles();

  return (
    <Tab.Navigator
      // initialRouteName="ShoppingList"
      screenOptions={({route}) => ({
        headerShown: false,

        // hide on keyboard open
        tabBarHideOnKeyboard: true,

        // tint colors
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,

        // bar styling
        tabBarStyle: styles.tabBar,

        tabBarIcon: ({focused, color, size}) => {
          let iconName: IconName;
          switch (route.name) {
            case 'Main':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'ShoppingList':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-circle'; // Fallback icon
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen
        name="Main"
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

const styles = StyleSheet.create(theme => ({
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    // height: 60, // you can customize height if needed
  },
}));

export default HomeTab;
