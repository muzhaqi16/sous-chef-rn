import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View, useWindowDimensions } from 'react-native';
import {
  TabView as RNTabView,
  TabBar,
  SceneRendererProps,
  NavigationState,
  Route,
} from 'react-native-tab-view';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';

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

const ThemedTabBar = withUnistyles(TabBar<TabRoute>, theme => ({
  indicatorStyle: {
    backgroundColor: theme.colors.primary,
    height: 3,
  },
  style: {
    backgroundColor: theme.colors.surface,
    elevation: 0,
    ...theme.shadows.none,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  activeColor: theme.colors.primary,
  inactiveColor: theme.colors.textSecondary,
}));

const DefaultLazyPlaceholder: React.FC<{ route: TabRoute }> = ({ route }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.placeholder}>
      <ThemedActivityIndicator size="large" />
      <Text tone="secondary">
        {t('loading.loadingNamed', { name: route.title })}
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
        <ThemedTabBar
          {...props}
          navigationState={{
            ...props.navigationState,
            routes: routesWithLabels,
          }}
          scrollEnabled={false}
          tabStyle={styles.tab}
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
  // Equal-width tabs: the bar is not scrollable, so every route shares the row.
  tab: {
    flex: 1,
  },
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
