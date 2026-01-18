import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import type { NavigationState, Route } from 'react-native-tab-view';
import type { FilterTabActionButton } from '#components/molecules/FilterTabs';

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

export const FilterTabBar: React.FC<FilterTabBarProps> = ({
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
        {navigationState.routes.map((route, index) => {
          const isActive = navigationState.index === index;
          const count = counts?.[route.key];
          const hasCount = count !== undefined;

          return (
            <Pressable
              key={route.key}
              onPress={() => handleTabPress(route.key)}
              testID={`${testIDPrefix}-${route.key}`}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive
                    ? theme.colors.filterTab.activeBg
                    : theme.colors.filterTab.inactiveBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive
                      ? theme.colors.filterTab.activeText
                      : theme.colors.filterTab.inactiveText,
                  },
                ]}
              >
                {route.title}
              </Text>
              {hasCount && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isActive
                        ? theme.colors.filterTab.activeCountBg
                        : theme.colors.filterTab.countBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      {
                        color: isActive
                          ? theme.colors.filterTab.activeText
                          : theme.colors.filterTab.countText,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {actionButton && (
        <Pressable
          onPress={actionButton.onPress}
          testID={actionButton.testID || `${testIDPrefix}-action`}
          style={[
            actionButton.label ? styles.actionLabelButton : styles.actionButton,
            !actionButton.label && {
              backgroundColor: theme.colors.filterTab.inactiveBg,
            },
          ]}
        >
          {actionButton.label ? (
            <Text style={[styles.actionLabel, { color: theme.colors.primary }]}>
              {actionButton.label}
            </Text>
          ) : actionButton.icon ? (
            <Icon
              name={actionButton.icon}
              size={20}
              color={theme.colors.primary}
              library={actionButton.iconLibrary || 'MaterialIcons'}
            />
          ) : null}
        </Pressable>
      )}
    </View>
  );
};

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
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['3'] + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    gap: theme.spacing.xs + 2,
  },
  tabLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
  },
  countBadge: {
    paddingHorizontal: theme.spacing.xs + 3,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
  },
  countText: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
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
  },
}));
