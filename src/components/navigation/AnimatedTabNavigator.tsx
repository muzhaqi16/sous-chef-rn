import React from 'react';
import { View } from 'react-native';
import {
  createBottomTabNavigator,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { TabBarActionsProvider } from '#/context/TabBarActionsContext';
import { FloatingTabBar } from './FloatingTabBar/FloatingTabBar';

interface AnimatedTabNavigatorProps<
  T extends Record<string, object | undefined>,
> {
  children: React.ReactNode;
  screenOptions?:
    | BottomTabNavigationOptions
    | ((props: { route: any; navigation: any }) => BottomTabNavigationOptions);
  initialRouteName?: Extract<keyof T, string>;
}

export function createAnimatedTabNavigator<
  T extends Record<string, object | undefined>,
>() {
  const Tab = createBottomTabNavigator<T>();

  const AnimatedTabNavigator: React.FC<AnimatedTabNavigatorProps<T>> = ({
    children,
    screenOptions,
    initialRouteName,
  }) => {
    const { theme } = useUnistyles();

    return (
      <TabBarActionsProvider>
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <Tab.Navigator
            initialRouteName={initialRouteName}
            detachInactiveScreens={true}
            screenOptions={
              typeof screenOptions === 'function'
                ? props => ({
                    headerShown: false,
                    tabBarHideOnKeyboard: true,
                    sceneStyle: { backgroundColor: 'transparent' },
                    tabBarStyle: { backgroundColor: 'transparent' },
                    ...screenOptions(props),
                  })
                : {
                    headerShown: false,
                    tabBarHideOnKeyboard: true,
                    sceneStyle: { backgroundColor: 'transparent' },
                    tabBarStyle: { backgroundColor: 'transparent' },
                    ...screenOptions,
                  }
            }
            tabBar={props => <FloatingTabBar {...props} />}
          >
            {children}
          </Tab.Navigator>
        </View>
      </TabBarActionsProvider>
    );
  };

  return {
    Navigator: AnimatedTabNavigator,
    Screen: Tab.Screen,
  };
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
