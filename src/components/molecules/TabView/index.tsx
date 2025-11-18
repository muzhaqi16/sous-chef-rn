import React, { useState, useCallback } from 'react';
import {
  View,
  useWindowDimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  TabView as RNTabView,
  TabBar,
  SceneRendererProps,
  NavigationState,
  Route,
} from 'react-native-tab-view';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';

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
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}

const DefaultLazyPlaceholder: React.FC<{ route: TabRoute }> = ({ route }) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.placeholder}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text
        style={[styles.placeholderText, { color: theme.colors.textSecondary }]}
      >
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
  onRefresh,
  refreshing = false,
}) => {
  const { theme } = useUnistyles();
  const layout = useWindowDimensions();
  const [index, setIndex] = useState(initialTabIndex);

  const handleIndexChange = useCallback(
    (newIndex: number) => {
      setIndex(newIndex);
      onIndexChange?.(newIndex);
    },
    [onIndexChange],
  );

  const renderTabBar = useCallback(
    (
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
            scrollEnabled={true}
            bounces={true}
            tabStyle={{
              flex: 1,
            }}
            style={{
              backgroundColor: theme.colors.surface,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
            activeColor={theme.colors.primary}
            inactiveColor={theme.colors.textSecondary}
          />
          {onRefresh && (
            <View style={styles.refreshButtonContainer}>
              <TouchableOpacity
                onPress={onRefresh}
                disabled={refreshing}
                style={styles.refreshButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {refreshing ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                ) : (
                  <Icon
                    name="refresh"
                    size={24}
                    color={theme.colors.primary}
                    library="MaterialIcons"
                  />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [theme, onRefresh, refreshing],
  );

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

const styles = StyleSheet.create(() => ({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  placeholderText: {
    fontSize: 16,
  },
  label: {
    fontSize: 14,
  },
  tabBarContainer: {
    position: 'relative',
  },
  refreshButtonContainer: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  refreshButton: {
    padding: 8,
  },
}));
