import React, { useState } from 'react';
import { View, useWindowDimensions, ActivityIndicator } from 'react-native';
import {
  TabView as RNTabView,
  TabBar,
  SceneRendererProps,
  NavigationState,
  Route,
} from 'react-native-tab-view';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

export interface TabRoute extends Route {
  key: string;
  title: string;
  badge?: number;
}

export interface TabViewProps {
  routes: TabRoute[];
  renderScene: (
    props: SceneRendererProps & { route: TabRoute },
  ) => React.ReactNode;
  initialTabIndex?: number;
  lazy?: boolean;
  lazyPreloadDistance?: number;
  onIndexChange?: (index: number) => void;
  renderLazyPlaceholder?: (props: { route: TabRoute }) => React.ReactNode;
  swipeEnabled?: boolean;
}

const DefaultLazyPlaceholder: React.FC<{ route: TabRoute }> = ({ route }) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.placeholder}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text size="md" tone="secondary">
        Loading {route.title}...
      </Text>
    </View>
  );
};

export const TabView: React.FC<TabViewProps> = ({
  routes,
  renderScene,
  initialTabIndex = 0,
  lazy = true,
  lazyPreloadDistance = 0,
  onIndexChange,
  renderLazyPlaceholder,
  swipeEnabled = true,
}) => {
  const { theme } = useUnistyles();
  const layout = useWindowDimensions();
  const [index, setIndex] = useState(initialTabIndex);

  const handleIndexChange = (newIndex: number) => {
    setIndex(newIndex);
    onIndexChange?.(newIndex);
  };

  const renderTabBar = (
    props: SceneRendererProps & {
      navigationState: NavigationState<TabRoute>;
    },
  ) => {
    // Format labels with badge counts
    const routesWithLabels = props.navigationState.routes.map(route => ({
      ...route,
      title:
        route.badge !== undefined && route.badge > 0
          ? `${route.title} (${route.badge})`
          : route.title,
    }));

    return (
      <View style={styles.tabBarContainer}>
        <TabBar
          {...props}
          navigationState={{
            ...props.navigationState,
            routes: routesWithLabels,
          }}
          indicatorStyle={{
            backgroundColor: theme.colors.primary,
            height: 3,
          }}
          scrollEnabled={false}
          tabStyle={{
            flex: 1,
          }}
          style={{
            backgroundColor: theme.colors.surface,
            elevation: 0,
            boxShadow: [],
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
          activeColor={theme.colors.primary}
          inactiveColor={theme.colors.textSecondary}
        />
      </View>
    );
  };

  return (
    <RNTabView
      lazy={lazy}
      lazyPreloadDistance={lazyPreloadDistance}
      navigationState={{ index, routes }}
      renderScene={renderScene}
      renderTabBar={renderTabBar}
      renderLazyPlaceholder={(props: { route: TabRoute }) =>
        renderLazyPlaceholder ? (
          renderLazyPlaceholder(props)
        ) : (
          <DefaultLazyPlaceholder {...props} />
        )
      }
      onIndexChange={handleIndexChange}
      initialLayout={{ width: layout.width }}
      swipeEnabled={swipeEnabled}
      overScrollMode="never"
    />
  );
};

const styles = StyleSheet.create(theme => ({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  tabBarContainer: {
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
}));
