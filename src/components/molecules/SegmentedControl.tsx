import React, { useLayoutEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from 'react-native-unistyles/reanimated';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  type DerivedValue,
} from 'react-native-reanimated';
import { HapticService } from '#services/haptic/HapticService';
import { Label } from '#components/atoms/Label';
import { motion } from '#/theme/foundations/motion';

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
  indicatorX: DerivedValue<number>;
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
  const animatedTheme = useAnimatedTheme();

  const textAnimatedStyle = useAnimatedStyle(() => {
    const tabCenter = index * tabWidth + tabWidth / 2;
    const indicatorCenter = indicatorX.get() + tabWidth / 2;
    const distance = Math.abs(tabCenter - indicatorCenter);
    const progress = Math.min(distance / Math.max(tabWidth, 1), 1);

    return {
      color: interpolateColor(
        progress,
        [0, 0.5],
        [
          animatedTheme.get().colors.onPrimary,
          animatedTheme.get().colors.textPrimary,
        ],
      ),
    };
  });

  const labelTypeStyle = useAnimatedStyle(() => ({
    ...animatedTheme.get().type.label,
  }));

  styles.useVariants({ compact: isCompact });

  return (
    <AppPressable style={styles.segment} onPress={onPress}>
      <Animated.Text
        style={[styles.segmentText, labelTypeStyle, textAnimatedStyle]}
        numberOfLines={2}
      >
        {formatLabel(option)}
      </Animated.Text>
    </AppPressable>
  );
};

/** Segmented control over any string enum or array, with a spring-driven pill. */
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

  const [contentWidth, setContentWidth] = useState(0);
  const tabWidth = contentWidth > 0 ? contentWidth / options.length : 0;
  const selectedIndex = Math.max(0, options.indexOf(value));

  // The resting position is DERIVED from the selection and measured width, so it
  // is right on the first measured frame and re-derives after a relayout — nothing
  // stored can go stale while Reanimated warms up. `offset` is only a transient
  // slide delta, seeded with the distance back to the old segment and sprung to 0.
  const offset = useSharedValue(0);
  const indicatorX = useDerivedValue(
    () => selectedIndex * tabWidth + offset.get(),
  );

  // Seeded in a layout effect, not the render body, so no SharedValue is written
  // during render; the prior index lives in a SharedValue so reading it here costs
  // no re-render. Only the transient slide — `indicatorX` owns the resting spot.
  const prevIndexSV = useSharedValue(selectedIndex);
  useLayoutEffect(() => {
    const fromIndex = prevIndexSV.get();
    if (fromIndex === selectedIndex) return;
    prevIndexSV.set(selectedIndex);
    if (tabWidth > 0) {
      offset.set((fromIndex - selectedIndex) * tabWidth);
      offset.set(withSpring(0, motion.spring.GENTLE));
    }
  }, [selectedIndex, tabWidth, offset, prevIndexSV]);

  const animatedTheme = useAnimatedTheme();

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.get() }],
    width: tabWidth,
    // Width is 0 until measured; the opacity gate keeps the always-mounted pill
    // from painting at the left edge before the first measurement.
    opacity: tabWidth > 0 ? 1 : 0,
    borderRadius: animatedTheme.get().radii.md,
    backgroundColor: animatedTheme.get().colors.primary,
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setContentWidth(event.nativeEvent.layout.width - 2);
  };

  styles.useVariants({ compact: isCompact });

  return (
    <View style={styles.container} testID={testID}>
      {label ? <Label required={required}>{label}</Label> : null}
      <View style={styles.segmentedControl} onLayout={handleLayout}>
        <Animated.View style={[styles.indicator, indicatorAnimatedStyle]} />
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
    variants: {
      compact: {
        true: { marginBottom: theme.spacing.sm },
      },
    },
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderCurve: 'continuous',
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    variants: {
      compact: {
        true: { paddingVertical: theme.spacing.sm },
      },
    },
  },
  segmentText: {
    textAlign: 'center',
  },
}));
