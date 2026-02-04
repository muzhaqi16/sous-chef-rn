import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface FilterTabItemProps {
  routeKey: string;
  title: string;
  isActive: boolean;
  count?: number;
  onPress: () => void;
  testID: string;
}

const FilterTabItemComponent: React.FC<FilterTabItemProps> = ({
  routeKey,
  title,
  isActive,
  count,
  onPress,
  testID,
}) => {
  styles.useVariants({ active: isActive });
  const hasCount = count !== undefined;

  return (
    <Pressable key={routeKey} onPress={onPress} testID={testID} style={styles.tab}>
      <Text style={styles.tabLabel}>{title}</Text>
      {hasCount && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
};

export const FilterTabItem = React.memo(FilterTabItemComponent);
FilterTabItem.displayName = 'FilterTabItem';

const styles = StyleSheet.create(theme => ({
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['3'] + 2,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    gap: theme.spacing.xs + 2,
    backgroundColor: theme.colors.filterTab.inactiveBg,
    variants: {
      active: {
        true: { backgroundColor: theme.colors.filterTab.activeBg },
      },
    },
  },
  tabLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.filterTab.inactiveText,
    variants: {
      active: {
        true: { color: theme.colors.filterTab.activeText },
      },
    },
  },
  countBadge: {
    paddingHorizontal: theme.spacing.xs + 3,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.filterTab.countBg,
    variants: {
      active: {
        true: { backgroundColor: theme.colors.filterTab.activeCountBg },
      },
    },
  },
  countText: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.filterTab.countText,
    variants: {
      active: {
        true: { color: theme.colors.filterTab.activeText },
      },
    },
  },
}));
