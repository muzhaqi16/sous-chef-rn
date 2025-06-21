import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import Ionicons from '@react-native-vector-icons/ionicons';

import MainScreen from '../screens/MainScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type {HomeTabParamList} from './types';

const Tab = createBottomTabNavigator<HomeTabParamList>();

const HomeTab = () => {
  const {theme, styles} = useStyles(stylesheet);

  return (
    <Tab.Navigator
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
          const iconName =
            route.name === 'ShoppingList'
              ? focused
                ? 'list'
                : 'list-outline'
              : focused
                ? 'person'
                : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen
        name="ShoppingList"
        component={MainScreen}
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

const stylesheet = createStyleSheet(theme => ({
  tabBar: {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    // height: 60, // you can customize height if needed
  },
}));

export default HomeTab;
