import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
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
export function FilterTabs<T extends string = string>({
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
        {tabs.map((tab: FilterTabConfig<T>) => {
          const isActive = activeTabId === tab.id;
          const isFiltered = !isActive && filteredTabIds?.includes(tab.id);
          const count = counts?.[tab.id];
          const hasCount = showCounts && count !== undefined;

          // Determine colors based on 3-state: active > filtered > inactive
          const backgroundColor = isActive
            ? theme.colors.filterTab.activeBg
            : isFiltered
              ? theme.colors.filterTab.filteredBg
              : theme.colors.filterTab.inactiveBg;

          const textColor = isActive
            ? theme.colors.filterTab.activeText
            : isFiltered
              ? theme.colors.filterTab.filteredText
              : theme.colors.filterTab.inactiveText;

          return (
            <Pressable
              key={tab.id}
              onPress={() => handleTabPress(tab)}
              testID={`${testIDPrefix}-${tab.id}`}
              style={[
                styles.tab,
                isCompact && styles.tabCompact,
                { backgroundColor },
              ]}
            >
              {tab.icon && (
                tab.iconLibrary ? (
                  <Icon
                    name={tab.icon}
                    size={tab.isAction ? (isCompact ? 18 : 20) : (isCompact ? 14 : 16)}
                    color={tab.isAction ? theme.colors.primary : textColor}
                    library={tab.iconLibrary}
                  />
                ) : (
                  <Text
                    style={[styles.tabIcon, isCompact && styles.tabIconCompact]}
                  >
                    {tab.icon}
                  </Text>
                )
              )}
              {!(tab.isAction && !tab.label) && (
                <Text
                  style={[
                    styles.tabLabel,
                    isCompact && styles.tabLabelCompact,
                    { color: textColor },
                  ]}
                >
                  {tab.label}
                </Text>
              )}
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
                          : isFiltered
                            ? theme.colors.filterTab.filteredText
                            : theme.colors.filterTab.countText,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
              {tab.showDropdownIndicator && (
                <Icon
                  name="chevron-down"
                  size={isCompact ? 12 : 14}
                  color={textColor}
                  library="Feather"
                />
              )}
            </Pressable>
          );
        })}
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
