import React from 'react';
import { View } from 'react-native';
import type { StaticParamList } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import {
  createBottomTabNavigator,
  createBottomTabScreen,
} from '@react-navigation/bottom-tabs';
import { TAB_FEATURES } from '#features/registry';
import { TabBarActionsProvider } from '#/context/TabBarActionsContext';
import { FloatingTabBar } from '#components/navigation/FloatingTabBar/FloatingTabBar';

function HomeTabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabBarActionsProvider>
      <View style={styles.layout}>{children}</View>
    </TabBarActionsProvider>
  );
}

const styles = StyleSheet.create(theme => ({
  layout: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

// Build tab screens from the feature registry (evaluated at module scope).
// Today all features are always enabled; adding a flag check here is a
// one-line change per entry when feature gating ships.
const tabScreens = Object.fromEntries(
  TAB_FEATURES.map(f => [
    f.tab.screenName,
    createBottomTabScreen({
      screen: f.tab.stack,
      options: { title: f.tab.title },
    }),
  ]),
);

export const HomeTabs = createBottomTabNavigator({
  tabBar: props => <FloatingTabBar {...props} />,
  layout: HomeTabsLayout,
  screenOptions: {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    lazy: true,
    // Crossfade between tabs instead of an instant cut. This is the most
    // repeated transition in the app; a hard swap reads as cheap.
    animation: 'fade',
  },
  screens: tabScreens,
});

export type HomeTabsParams = StaticParamList<typeof HomeTabs>;
