import React, { useState } from 'react';
import { View, Pressable, type LayoutChangeEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import { HapticService } from '#services/haptic/HapticService';
import { Label } from '#components/atoms/Label';
import { SPRING } from '#/constants/animations';

const identity = <T extends string>(v: T): string => v;

interface SegmentedControlProps<T extends string> {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatLabel?: (value: T) => string;
  required?: boolean;
  testID?: string;
  size?: 'default' | 'compact';
}

interface SegmentedTabProps<T extends string> {
  option: T;
  index: number;
  isCompact: boolean;
  formatLabel: (value: T) => string;
  onPress: () => void;
  indicatorX: SharedValue<number>;
  tabWidth: number;
}

/** Individual tab with animated text color that reacts to the sliding indicator. */
const SegmentedTab = <T extends string>({
  option,
  index,
  isCompact,
  formatLabel,
  onPress,
  indicatorX,
  tabWidth,
}: SegmentedTabProps<T>) => {
  const { theme } = useUnistyles();

  const textAnimatedStyle = useAnimatedStyle(() => {
    const tabCenter = index * tabWidth + tabWidth / 2;
    const indicatorCenter = indicatorX.value + tabWidth / 2;
    const distance = Math.abs(tabCenter - indicatorCenter);
    const progress = Math.min(distance / Math.max(tabWidth, 1), 1);

    return {
      color: interpolateColor(
        progress,
        [0, 0.5],
        [theme.colors.white, theme.colors.textPrimary],
      ),
    };
  });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.segment,
        isCompact && styles.segmentCompact,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Animated.Text
        style={[styles.segmentText, textAnimatedStyle]}
        numberOfLines={1}
      >
        {formatLabel(option)}
      </Animated.Text>
    </Pressable>
  );
};

/**
 * SegmentedControl - Reusable segmented control for selecting from options
 * Generic component that works with any string enum or array of string values
 *
 * Features a fluid sliding indicator pill with spring physics and
 * interpolated text color transitions.
 */
export const SegmentedControl = <T extends string>({
  label,
  options,
  value,
  onChange,
  formatLabel = identity,
  required,
  testID,
  size = 'default',
}: SegmentedControlProps<T>) => {
  const isCompact = size === 'compact';

  // Layout measurement — subtract border (1px each side) for inner content width
  const [contentWidth, setContentWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const tabWidth = contentWidth > 0 ? contentWidth / options.length : 0;
  const selectedIndex = options.indexOf(value);

  // Adjusting state during render — detect value/layout changes (AnimatedChip pattern)
  const [prev, setPrev] = useState({ value, hasLayout: false });

  if (contentWidth > 0 && !prev.hasLayout) {
    // First layout: instant position, no animation
    setPrev({ value, hasLayout: true });
    indicatorX.set(selectedIndex * tabWidth);
  } else if (value !== prev.value && prev.hasLayout) {
    // Value changed after layout: animate with spring
    setPrev({ value, hasLayout: true });
    indicatorX.set(withSpring(selectedIndex * tabWidth, SPRING.GENTLE));
  }

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: tabWidth,
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setContentWidth(event.nativeEvent.layout.width - 2);
  };

  return (
    <View
      style={[styles.container, isCompact && styles.containerCompact]}
      testID={testID}
    >
      {label ? <Label required={required}>{label}</Label> : null}
      <View style={styles.segmentedControl} onLayout={handleLayout}>
        {contentWidth > 0 && (
          <Animated.View style={[styles.indicator, indicatorAnimatedStyle]} />
        )}
        {options.map((option, index) => (
          <SegmentedTab
            key={option}
            option={option}
            index={index}
            isCompact={isCompact}
            formatLabel={formatLabel}
            onPress={() => {
              HapticService.selection();
              onChange(option);
            }}
            indicatorX={indicatorX}
            tabWidth={tabWidth}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  containerCompact: {
    marginBottom: theme.spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.md,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentCompact: {
    paddingVertical: theme.spacing.sm,
  },
  segmentText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
