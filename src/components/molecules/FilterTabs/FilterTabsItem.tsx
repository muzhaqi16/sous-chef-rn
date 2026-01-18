import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import type { FilterTabConfig } from './types';

interface FilterTabsItemProps<T extends string> {
  tab: FilterTabConfig<T>;
  isActive: boolean;
  isFiltered: boolean;
  count?: number;
  showCounts: boolean;
  isCompact: boolean;
  onPress: () => void;
  testID: string;
}

function FilterTabsItemComponent<T extends string>({
  tab,
  isActive,
  isFiltered,
  count,
  showCounts,
  isCompact,
  onPress,
  testID,
}: FilterTabsItemProps<T>): React.ReactElement {
  // Use 3-state variant: active > filtered > inactive
  const state = isActive ? 'active' : isFiltered ? 'filtered' : 'inactive';
  styles.useVariants({ state, compact: isCompact });

  const hasCount = showCounts && count !== undefined;

  return (
    <Pressable onPress={onPress} testID={testID} style={styles.tab}>
      {tab.icon && (
        tab.iconLibrary ? (
          <Icon
            name={tab.icon}
            size={tab.isAction ? (isCompact ? 18 : 20) : (isCompact ? 14 : 16)}
            color={tab.isAction ? styles.iconActionColor.color : styles.iconColor.color}
            library={tab.iconLibrary}
          />
        ) : (
          <Text style={styles.tabIcon}>{tab.icon}</Text>
        )
      )}
      {!(tab.isAction && !tab.label) && (
        <Text style={styles.tabLabel}>{tab.label}</Text>
      )}
      {hasCount && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
      {tab.showDropdownIndicator && (
        <Icon
          name="chevron-down"
          size={isCompact ? 12 : 14}
          color={styles.iconColor.color}
          library="Feather"
        />
      )}
    </Pressable>
  );
}

export const FilterTabsItem = React.memo(FilterTabsItemComponent) as typeof FilterTabsItemComponent;

const styles = StyleSheet.create(theme => ({
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['3'] + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    gap: theme.spacing.xs + 2,
    backgroundColor: theme.colors.filterTab.inactiveBg,
    variants: {
      state: {
        active: { backgroundColor: theme.colors.filterTab.activeBg },
        filtered: { backgroundColor: theme.colors.filterTab.filteredBg },
        inactive: { backgroundColor: theme.colors.filterTab.inactiveBg },
      },
      compact: {
        true: {
          paddingHorizontal: theme.spacing.sm + 2,
          paddingVertical: theme.spacing.xs + 2,
          borderRadius: theme.radii.lg,
          gap: theme.spacing.xs,
        },
      },
    },
  },
  tabIcon: {
    fontSize: theme.typography.fontSize.sm,
    variants: {
      compact: {
        true: { fontSize: theme.typography.fontSize.xs },
      },
    },
  },
  tabLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.filterTab.inactiveText,
    variants: {
      state: {
        active: { color: theme.colors.filterTab.activeText },
        filtered: { color: theme.colors.filterTab.filteredText },
        inactive: { color: theme.colors.filterTab.inactiveText },
      },
      compact: {
        true: { fontSize: theme.typography.fontSize.xs },
      },
    },
  },
  countBadge: {
    paddingHorizontal: theme.spacing.xs + 3,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.filterTab.countBg,
    variants: {
      state: {
        active: { backgroundColor: theme.colors.filterTab.activeCountBg },
        filtered: { backgroundColor: theme.colors.filterTab.countBg },
        inactive: { backgroundColor: theme.colors.filterTab.countBg },
      },
      compact: {
        true: {
          paddingHorizontal: theme.spacing.xs + 1,
          paddingVertical: 1,
          borderRadius: theme.radii.sm,
        },
      },
    },
  },
  countText: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.filterTab.countText,
    variants: {
      state: {
        active: { color: theme.colors.filterTab.activeText },
        filtered: { color: theme.colors.filterTab.filteredText },
        inactive: { color: theme.colors.filterTab.countText },
      },
      compact: {
        true: { fontSize: theme.typography.fontSize.xs - 2 },
      },
    },
  },
  // Helper style objects for extracting colors in Icon components
  iconColor: {
    color: theme.colors.filterTab.inactiveText,
    variants: {
      state: {
        active: { color: theme.colors.filterTab.activeText },
        filtered: { color: theme.colors.filterTab.filteredText },
        inactive: { color: theme.colors.filterTab.inactiveText },
      },
    },
  },
  iconActionColor: {
    color: theme.colors.primary,
  },
}));
