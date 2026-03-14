import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { HapticService } from '#services/haptic/HapticService';

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
  const hasCount = count !== undefined;

  return (
    <Pressable
      key={routeKey}
      onPress={() => {
        HapticService.selection();
        onPress();
      }}
      testID={testID}
      style={[styles.tab, isActive && styles.tabActive]}
    >
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
        {title}
      </Text>
      {!!hasCount && (
        <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
          <Text style={[styles.countText, isActive && styles.countTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export const FilterTabItem = FilterTabItemComponent;
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
  },
  tabActive: {
    backgroundColor: theme.colors.filterTab.activeBg,
  },
  tabLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.filterTab.inactiveText,
  },
  tabLabelActive: {
    color: theme.colors.filterTab.activeText,
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
  countText: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.filterTab.countText,
  },
  countTextActive: {
    color: theme.colors.filterTab.activeText,
  },
}));
