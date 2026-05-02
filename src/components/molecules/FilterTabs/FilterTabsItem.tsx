import React from 'react';
import { View, Text, type LayoutChangeEvent } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { HapticService } from '#services/haptic/HapticService';
import type { FilterTabConfig } from './types';

/** Icon names are ASCII-only (e.g. "snow-outline"); emojis contain non-ASCII. */
function isEmoji(value: string): boolean {
  return /[^\u0020-\u007E]/.test(value);
}

interface FilterTabsItemProps<T extends string> {
  tab: FilterTabConfig<T>;
  isActive: boolean;
  isFiltered: boolean;
  count?: number;
  showCounts: boolean;
  isCompact: boolean;
  onPress: (tabId: T) => void;
  testID: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}

function getIconColor(isActive: boolean, isFiltered: boolean): string {
  const theme = UnistylesRuntime.getTheme();
  if (isActive) return theme.colors.filterTab.activeText;
  if (isFiltered) return theme.colors.filterTab.filteredText;
  return theme.colors.filterTab.inactiveText;
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
  onLayout,
}: FilterTabsItemProps<T>): React.ReactElement {
  const hasCount = showCounts && count !== undefined;
  const iconColor = tab.isAction
    ? UnistylesRuntime.getTheme().colors.primary
    : getIconColor(isActive, isFiltered);

  const handlePress = () => {
    HapticService.selection();
    onPress(tab.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      onLayout={onLayout}
      testID={testID}
      style={[
        styles.tab,
        isActive && styles.tabActive,
        isActive && tab.activeColor
          ? { backgroundColor: tab.activeColor }
          : undefined,
        isFiltered && !isActive && styles.tabFiltered,
        isCompact && styles.tabCompact,
      ]}
    >
      {tab.iconElement != null
        ? React.isValidElement(tab.iconElement)
          ? React.cloneElement(
              tab.iconElement as React.ReactElement<{ color?: string }>,
              {
                color: isActive || isFiltered ? iconColor : undefined,
              },
            )
          : tab.iconElement
        : !!tab.icon &&
          (isEmoji(tab.icon) ? (
            <Text style={isCompact ? styles.tabIconCompact : styles.tabIcon}>
              {tab.icon}
            </Text>
          ) : (
            <Icon
              name={tab.icon}
              size={tab.isAction ? (isCompact ? 18 : 20) : isCompact ? 14 : 16}
              color={iconColor}
              library={tab.iconLibrary}
            />
          ))}
      {!(tab.isAction && !tab.label) && (
        <Text
          style={[
            styles.tabLabel,
            isActive && styles.tabLabelActive,
            isFiltered && !isActive && styles.tabLabelFiltered,
            isCompact && styles.tabLabelCompact,
          ]}
        >
          {tab.label}
        </Text>
      )}
      {!!hasCount && (
        <View
          style={[
            styles.countBadge,
            isActive && styles.countBadgeActive,
            isCompact && styles.countBadgeCompact,
          ]}
        >
          <Text
            style={[
              styles.countText,
              isActive && styles.countTextActive,
              isFiltered && !isActive && styles.countTextFiltered,
              isCompact && styles.countTextCompact,
            ]}
          >
            {count}
          </Text>
        </View>
      )}
      {!!tab.showDropdownIndicator && (
        <Icon
          name="chevron-down"
          size={isCompact ? 12 : 14}
          color={iconColor}
        />
      )}
    </Pressable>
  );
}

export const FilterTabsItem = FilterTabsItemComponent;

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
  },
  tabActive: {
    backgroundColor: theme.colors.filterTab.activeBg,
  },
  tabFiltered: {
    backgroundColor: theme.colors.filterTab.filteredBg,
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
    color: theme.colors.filterTab.inactiveText,
  },
  tabLabelActive: {
    color: theme.colors.filterTab.activeText,
  },
  tabLabelFiltered: {
    color: theme.colors.filterTab.filteredText,
  },
  tabLabelCompact: {
    fontSize: theme.typography.fontSize.xs,
  },
  countBadge: {
    paddingHorizontal: theme.spacing.xs + 3,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.filterTab.countBg,
  },
  countBadgeActive: {
    backgroundColor: theme.colors.filterTab.activeCountBg,
  },
  countBadgeCompact: {
    paddingHorizontal: theme.spacing.xs + 1,
    paddingVertical: 1,
    borderRadius: theme.radii.sm,
  },
  countText: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.filterTab.countText,
  },
  countTextActive: {
    color: theme.colors.filterTab.activeText,
  },
  countTextFiltered: {
    color: theme.colors.filterTab.filteredText,
  },
  countTextCompact: {
    fontSize: theme.typography.fontSize.xs - 2,
  },
}));
