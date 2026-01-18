import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { FilterTabsItem } from './FilterTabsItem';
import type { FilterTabConfig, FilterTabsProps } from './types';

export type { FilterTabConfig, FilterTabsProps, FilterTabActionButton } from './types';

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
function FilterTabsComponent<T extends string = string>({
  tabs,
  activeTabId,
  onTabChange,
  counts,
  showCounts = true,
  variant = 'default',
  testIDPrefix = 'filter-tab',
  actionButton,
  filteredTabIds,
}: FilterTabsProps<T>): React.ReactElement {
  const { theme } = useUnistyles();

  const handleTabPress = useCallback(
    (tab: FilterTabConfig<T>) => {
      if (tab.onPress) {
        tab.onPress();
      } else {
        onTabChange(tab.id);
      }
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
        style={styles.scrollView}
      >
        {tabs.map((tab: FilterTabConfig<T>) => (
          <FilterTabsItem
            key={tab.id}
            tab={tab}
            isActive={activeTabId === tab.id}
            isFiltered={!!(activeTabId !== tab.id && filteredTabIds?.includes(tab.id))}
            count={counts?.[tab.id]}
            showCounts={showCounts}
            isCompact={isCompact}
            onPress={() => handleTabPress(tab)}
            testID={`${testIDPrefix}-${tab.id}`}
          />
        ))}
        {actionButton && (
          <Pressable
            onPress={actionButton.disabled ? undefined : actionButton.onPress}
            testID={actionButton.testID || `${testIDPrefix}-action`}
            style={[
              styles.tab,
              isCompact && styles.tabCompact,
              { backgroundColor: theme.colors.filterTab.inactiveBg },
              actionButton.disabled && { opacity: 0.4 },
            ]}
            disabled={actionButton.disabled}
          >
            {actionButton.icon && (
              <Icon
                name={actionButton.icon}
                size={isCompact ? 14 : 16}
                color={theme.colors.primary}
                library={actionButton.iconLibrary || 'MaterialIcons'}
              />
            )}
            {actionButton.label && (
              <Text
                style={[
                  styles.tabLabel,
                  isCompact && styles.tabLabelCompact,
                  { color: theme.colors.primary },
                ]}
              >
                {actionButton.label}
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

export const FilterTabs = React.memo(FilterTabsComponent) as typeof FilterTabsComponent;

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  tabLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
  },
  tabLabelCompact: {
    fontSize: theme.typography.fontSize.xs,
  },
}));
