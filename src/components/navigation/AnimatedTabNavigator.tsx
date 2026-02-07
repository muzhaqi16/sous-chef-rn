import React from 'react';
import { Animated, Easing, View } from 'react-native';
import {
  createBottomTabNavigator,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { TabBarActionsProvider } from '#/context/TabBarActionsContext';
import { FloatingTabBar } from './FloatingTabBar/FloatingTabBar';

const tabTransitionSpec = {
  animation: 'timing' as const,
  config: {
    duration: 200,
    easing: Easing.inOut(Easing.ease),
  },
};

const forSmoothShift = ({
  current,
}: {
  current: { progress: Animated.AnimatedInterpolation<number> };
}) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({
      inputRange: [-1, -0.25, 0, 0.25, 1],
      outputRange: [0, 0.75, 1, 0.75, 0],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-30, 0, 30],
          extrapolate: 'clamp',
        }),
      },
    ],
  },
});

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
            implementation="custom"
            initialRouteName={initialRouteName}
            screenOptions={props => {
              const userOptions =
                typeof screenOptions === 'function'
                  ? screenOptions(props)
                  : screenOptions;

              return {
                headerShown: false,
                tabBarHideOnKeyboard: true,
                lazy: true,
                transitionSpec: tabTransitionSpec,
                sceneStyleInterpolator: forSmoothShift,
                sceneStyle: { backgroundColor: theme.colors.background },
                ...userOptions,
              };
            }}
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
