import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { FilterTabConfig, FilterTabsProps } from './types';

export type { FilterTabConfig, FilterTabsProps } from './types';

/**
 * Generic configurable tab filter component
 *
 * @example
 * // Pantry location filter
 * <FilterTabs
 *   tabs={[
 *     { id: 'all', label: 'All' },
 *     { id: 'fridge', label: 'Fridge', icon: '🧊' },
 *   ]}
 *   activeTabId={locationFilter}
 *   onTabChange={setLocationFilter}
 *   counts={locationCounts}
 * />
 */
export function FilterTabs<T extends string = string>({
  tabs,
  activeTabId,
  onTabChange,
  counts,
  showCounts = true,
  variant = 'default',
  testIDPrefix = 'filter-tab',
}: FilterTabsProps<T>): React.ReactElement {
  const { theme } = useUnistyles();

  const handleTabPress = useCallback(
    (tabId: T) => {
      onTabChange(tabId);
    },
    [onTabChange],
  );

  const isCompact = variant === 'compact';

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab: FilterTabConfig<T>) => {
          const isActive = activeTabId === tab.id;
          const count = counts?.[tab.id];
          const hasCount = showCounts && count !== undefined;

          return (
            <Pressable
              key={tab.id}
              onPress={() => handleTabPress(tab.id)}
              testID={`${testIDPrefix}-${tab.id}`}
              style={[
                styles.tab,
                isCompact && styles.tabCompact,
                {
                  backgroundColor: isActive
                    ? theme.colors.filterTab.activeBg
                    : theme.colors.filterTab.inactiveBg,
                },
              ]}
            >
              {tab.icon && (
                <Text
                  style={[styles.tabIcon, isCompact && styles.tabIconCompact]}
                >
                  {tab.icon}
                </Text>
              )}
              <Text
                style={[
                  styles.tabLabel,
                  isCompact && styles.tabLabelCompact,
                  {
                    color: isActive
                      ? theme.colors.filterTab.activeText
                      : theme.colors.filterTab.inactiveText,
                  },
                ]}
              >
                {tab.label}
              </Text>
              {hasCount && (
                <View
                  style={[
                    styles.countBadge,
                    isCompact && styles.countBadgeCompact,
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
                      isCompact && styles.countTextCompact,
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
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    paddingVertical: theme.spacing.md,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
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
  tabCompact: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radii.lg,
    gap: theme.spacing.xs,
  },
  tabIcon: {
    fontSize: theme.typography.fontSize.sm,
  },
  tabIconCompact: {
    fontSize: theme.typography.fontSize.xs,
  },
  tabLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
  },
  tabLabelCompact: {
    fontSize: theme.typography.fontSize.xs,
  },
  countBadge: {
    paddingHorizontal: theme.spacing.xs + 3,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
  },
  countBadgeCompact: {
    paddingHorizontal: theme.spacing.xs + 1,
    paddingVertical: 1,
    borderRadius: theme.radii.sm,
  },
  countText: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
  },
  countTextCompact: {
    fontSize: theme.typography.fontSize.xs - 2,
  },
}));
