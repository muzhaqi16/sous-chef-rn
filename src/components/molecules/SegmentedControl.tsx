import React, { useState } from 'react';
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
          animatedTheme.get().colors.white,
          animatedTheme.get().colors.textPrimary,
        ],
      ),
    };
  });

  styles.useVariants({ compact: isCompact });

  return (
    <AppPressable style={styles.segment} onPress={onPress}>
      <Animated.Text
        style={[styles.segmentText, textAnimatedStyle]}
        numberOfLines={2}
      >
        {formatLabel(option)}
      </Animated.Text>
    </AppPressable>
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
  const tabWidth = contentWidth > 0 ? contentWidth / options.length : 0;
  const selectedIndex = Math.max(0, options.indexOf(value));

  // The pill's resting position is derived live from the selected segment and
  // the measured width, so it is correct on the first measured frame (including
  // the first cold-boot frame) and re-derives after any relayout such as a
  // rotation — nothing is stored to go stale or be dropped while Reanimated's
  // runtime is still warming up. `offset` is a transient slide delta: on a
  // selection change we seed it with the distance back to the old segment and
  // spring it to 0, which slides the pill from the old segment to the new one.
  const offset = useSharedValue(0);
  const indicatorX = useDerivedValue(
    () => selectedIndex * tabWidth + offset.get(),
    [selectedIndex, tabWidth],
  );

  const [prevIndex, setPrevIndex] = useState(selectedIndex);
  if (prevIndex !== selectedIndex) {
    const fromDelta = (prevIndex - selectedIndex) * tabWidth;
    setPrevIndex(selectedIndex);
    if (tabWidth > 0) {
      offset.set(fromDelta);
      offset.set(withSpring(0, SPRING.GENTLE));
    }
  }

  const animatedTheme = useAnimatedTheme();

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.get() }],
    width: tabWidth,
    // Width is 0 until measured; gate opacity too so the always-mounted pill
    // never paints at the left edge before the first measurement.
    opacity: tabWidth > 0 ? 1 : 0,
    // Read the brand color inside the worklet (the same channel the tab text
    // already uses) so Reanimated is the sole writer of this node. When the
    // color lived on the static stylesheet, Reanimated and Unistyles both
    // committed to this one native node, and a Reanimated commit could land
    // over a freshly-applied theme color — pinning the pill to the previous
    // brand color until the screen remounted.
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
    borderRadius: theme.radii.md,
    // backgroundColor is driven by the worklet in `indicatorAnimatedStyle`, not
    // here — see the comment there for why the brand color must not live on the
    // static stylesheet of a node Reanimated also commits to.
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
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    textAlign: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
