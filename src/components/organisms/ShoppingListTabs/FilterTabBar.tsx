import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { NavigationState, Route } from 'react-native-tab-view';
import type { FilterTabActionButton } from '#components/molecules/FilterTabs/types';
import { FilterTabItem } from './FilterTabItem';

interface FilterTabBarRoute extends Route {
  key: string;
  title: string;
}

interface FilterTabBarProps {
  navigationState: NavigationState<FilterTabBarRoute>;
  jumpTo: (key: string) => void;
  counts?: Record<string, number>;
  actionButton?: FilterTabActionButton;
  testIDPrefix?: string;
}

const FilterTabBarComponent: React.FC<FilterTabBarProps> = ({
  navigationState,
  jumpTo,
  counts,
  actionButton,
  testIDPrefix = 'filter-tab',
}) => {
  const { theme } = useUnistyles();

  const handleTabPress = useCallback(
    (key: string) => {
      jumpTo(key);
    },
    [jumpTo],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {navigationState.routes.map((route, index) => (
          <FilterTabItem
            key={route.key}
            routeKey={route.key}
            title={route.title}
            isActive={navigationState.index === index}
            count={counts?.[route.key]}
            onPress={() => handleTabPress(route.key)}
            testID={`${testIDPrefix}-${route.key}`}
          />
        ))}
      </ScrollView>
      {actionButton && (
        <Pressable
          onPress={actionButton.onPress}
          testID={actionButton.testID || `${testIDPrefix}-action`}
          style={[
            actionButton.label ? styles.actionLabelButton : styles.actionButton,
            !actionButton.label && styles.actionButtonWithBg,
          ]}
        >
          {actionButton.label ? (
            <Text style={styles.actionLabel}>
              {actionButton.label}
            </Text>
          ) : actionButton.icon ? (
            <Icon
              name={actionButton.icon}
              size={20}
              color={theme.colors.primary}
              library={actionButton.iconLibrary}
            />
          ) : null}
        </Pressable>
      )}
    </View>
  );
};

export const FilterTabBar = FilterTabBarComponent;
FilterTabBar.displayName = 'FilterTabBar';

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    gap: theme.spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
  },
  actionButtonWithBg: {
    backgroundColor: theme.colors.filterTab.inactiveBg,
  },
  actionLabelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  actionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
}));
