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
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tabCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabIconCompact: {
    fontSize: 12,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: theme.fonts.weight.semibold,
  },
  tabLabelCompact: {
    fontSize: 12,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeCompact: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countText: {
    fontSize: 11,
    fontWeight: theme.fonts.weight.bold,
  },
  countTextCompact: {
    fontSize: 10,
  },
}));
