import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import Ionicons from '@react-native-vector-icons/ionicons';

import ProfileScreen from '../screens/ProfileScreen';
import {MainScreen} from '../screens/MainScreen'; // Assuming MainScreen is the same as ShoppingListScreen
import ShoppingListScreen from '../screens/ShoppingListScreen';
import type {HomeTabParamList} from './types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const Tab = createBottomTabNavigator<HomeTabParamList>();

const HomeTab = () => {
  const {theme, styles} = useStyles(stylesheet);

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
        component={MainScreen} // Assuming MainScreen is the same as ShoppingListScreen
        options={{title: 'Pantry'}}
      />
      <Tab.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
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
