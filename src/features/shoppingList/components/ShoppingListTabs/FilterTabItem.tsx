import React, { useRef } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { HapticService } from '#services/haptic/HapticService';
import { Text } from '#components/atoms/Text';

interface FilterTabItemProps {
  routeKey: string;
  title: string;
  isActive: boolean;
  count?: number;
  onPress: () => void;
  testID: string;
  /** Optional: measure this tab's screen-coordinate rect for tutorial spotlight */
  onMeasure?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

const FilterTabItemComponent: React.FC<FilterTabItemProps> = ({
  routeKey,
  title,
  isActive,
  count,
  onPress,
  testID,
  onMeasure,
}) => {
  const hasCount = count !== undefined;
  const tabRef = useRef<View>(null);

  const handleLayout = () => {
    if (!onMeasure) return;
    requestAnimationFrame(() => {
      tabRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          onMeasure({ x: pageX, y: pageY, width: w, height: h });
        }
      });
    });
  };

  return (
    <View
      ref={onMeasure ? tabRef : undefined}
      collapsable={false}
      onLayout={onMeasure ? handleLayout : undefined}
    >
      <Pressable
        key={routeKey}
        onPress={() => {
          HapticService.selection();
          onPress();
        }}
        testID={testID}
        style={[styles.tab, isActive && styles.tabActive]}
      >
        <Text
          weight="semibold"
          style={[styles.tabLabel, isActive && styles.tabLabelActive]}
        >
          {title}
        </Text>
        {!!hasCount && (
          <View
            style={[styles.countBadge, isActive && styles.countBadgeActive]}
          >
            <Text
              weight="bold"
              style={[styles.countText, isActive && styles.countTextActive]}
            >
              {count}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
};

export const FilterTabItem = FilterTabItemComponent;
FilterTabItem.displayName = 'FilterTabItem';

const styles = StyleSheet.create(theme => ({
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.basePlus,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    gap: theme.spacing.xsPlus,
    backgroundColor: theme.colors.filterTab.inactiveBg,
  },
  tabActive: {
    backgroundColor: theme.colors.filterTab.activeBg,
  },
  tabLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.filterTab.inactiveText,
  },
  tabLabelActive: {
    color: theme.colors.filterTab.activeText,
  },
  countBadge: {
    paddingHorizontal: theme.spacing.xsPlus,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.filterTab.countBg,
  },
  countBadgeActive: {
    backgroundColor: theme.colors.filterTab.activeCountBg,
  },
  countText: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.filterTab.countText,
  },
  countTextActive: {
    color: theme.colors.filterTab.activeText,
  },
}));
