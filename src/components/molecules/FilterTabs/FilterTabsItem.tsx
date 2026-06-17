import React from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Pressable, ThemedIcon } from '#components/atoms/themedComponents';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { HapticService } from '#services/haptic/HapticService';
import type { FilterTabConfig } from './types';
import { Text } from '#components/atoms/Text';

type IconColorState = 'action' | 'active' | 'filtered' | 'inactive';

type FilterTabTheme = {
  colors: {
    primary: string;
    filterTab: {
      activeText: string;
      filteredText: string;
      inactiveText: string;
    };
  };
};

function resolveIconColor(state: IconColorState, t: FilterTabTheme): string {
  switch (state) {
    case 'action':
      return t.colors.primary;
    case 'active':
      return t.colors.filterTab.activeText;
    case 'filtered':
      return t.colors.filterTab.filteredText;
    case 'inactive':
    default:
      return t.colors.filterTab.inactiveText;
  }
}

/**
 * Wraps an externally-provided iconElement and re-clones it with the
 * theme-correct color. Theme reactivity comes from withUnistyles.
 */
const ColoredIconElement = withUnistyles(
  ({
    element,
    color,
  }: {
    element: React.ReactElement<{ color?: string }>;
    color?: string;
  }) => React.cloneElement(element, { color }),
);

/** Icon names are ASCII-only (e.g. "snow-outline"); emojis contain non-ASCII. */
function isEmoji(value: string): boolean {
  return /[^ -~]/.test(value);
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

  const iconColorState: IconColorState = tab.isAction
    ? 'action'
    : isActive
    ? 'active'
    : isFiltered
    ? 'filtered'
    : 'inactive';

  styles.useVariants({
    state: isActive ? 'active' : isFiltered ? 'filtered' : 'inactive',
    compact: isCompact,
    stacked: !!tab.subLabel,
  });

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
        isActive && tab.activeColor
          ? { backgroundColor: tab.activeColor }
          : undefined,
      ]}
    >
      {tab.iconElement != null ? (
        React.isValidElement(tab.iconElement) ? (
          <ColoredIconElement
            element={tab.iconElement as React.ReactElement<{ color?: string }>}
            uniProps={t => ({
              color:
                isActive || isFiltered
                  ? resolveIconColor(iconColorState, t)
                  : undefined,
            })}
          />
        ) : (
          tab.iconElement
        )
      ) : (
        !!tab.icon &&
        (isEmoji(tab.icon) ? (
          <Text size={isCompact ? 'xs' : 'sm'}>{tab.icon}</Text>
        ) : (
          <ThemedIcon
            name={tab.icon}
            size={tab.isAction ? (isCompact ? 18 : 20) : isCompact ? 14 : 16}
            uniProps={t => ({ color: resolveIconColor(iconColorState, t) })}
            library={tab.iconLibrary}
          />
        ))
      )}
      {!(tab.isAction && !tab.label) &&
        (tab.subLabel ? (
          <View style={styles.labelColumn}>
            <Text style={styles.tabLabel}>{tab.label}</Text>
            <Text style={styles.tabSubLabel} numberOfLines={1}>
              {tab.subLabel}
            </Text>
          </View>
        ) : (
          <Text style={styles.tabLabel}>{tab.label}</Text>
        ))}
      {!!hasCount && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
      {!!tab.showDropdownIndicator && (
        <ThemedIcon
          name="chevron-down"
          size={isCompact ? 12 : 14}
          uniProps={t => ({ color: resolveIconColor(iconColorState, t) })}
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
    paddingVertical: theme.spacing.xs + 1,
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
      // Two-line pills (label + parent) trim the vertical padding so they sit
      // at roughly the same height as single-line pills in the same row.
      stacked: {
        true: { paddingVertical: theme.spacing.xs + 2 },
      },
    },
  },
  labelColumn: {
    alignItems: 'flex-start',
    justifyContent: 'center',
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
      // Tight leading when stacked above a sub-label, so the two lines don't
      // inherit the body line-height and balloon the pill height.
      stacked: {
        true: { lineHeight: theme.typography.fontSize.base },
      },
    },
  },
  // Parent location shown under the label — smaller and slightly muted so the
  // main label stays dominant while still disambiguating same-named children.
  tabSubLabel: {
    fontSize: theme.typography.fontSize.xs - 2,
    lineHeight: theme.typography.fontSize.xs + 1,
    fontWeight: theme.fonts.weight.medium,
    opacity: 0.7,
    color: theme.colors.filterTab.inactiveText,
    variants: {
      state: {
        active: { color: theme.colors.filterTab.activeText },
        filtered: { color: theme.colors.filterTab.filteredText },
        inactive: { color: theme.colors.filterTab.inactiveText },
      },
      compact: {
        true: { fontSize: theme.typography.fontSize.xs - 2 },
      },
    },
  },
  countBadge: {
    paddingHorizontal: theme.spacing.xs + 3,
    paddingVertical: 2,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.filterTab.countBg,
    variants: {
      state: {
        active: { backgroundColor: theme.colors.filterTab.activeCountBg },
        filtered: {},
        inactive: {},
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
        inactive: {},
      },
      compact: {
        true: { fontSize: theme.typography.fontSize.xs - 2 },
      },
    },
  },
}));
