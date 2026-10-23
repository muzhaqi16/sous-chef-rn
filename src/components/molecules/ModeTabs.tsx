import React, { useLayoutEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { useMeasuredRect } from '#hooks/ui/useMeasuredRect';
import { HapticService } from '#services/haptic/HapticService';
import { motion } from '#/theme/motion';

/** A view's on-screen rect. */
type TabRect = { x: number; y: number; width: number; height: number };

/** A tab's place in the row, for the underline. */
type Span = { x: number; width: number };

interface ModeTabsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatLabel: (value: T) => string;
  /** A count shown after a tab's label, such as the items in that view. */
  countOf?: (value: T) => number | undefined;
  /** Each tab's own testID, for a tab a test or flow taps by name. */
  tabTestID?: (value: T) => string;
  /** A tab's screen rect once laid out, for a tutorial to point at. */
  onTabLayout?: (value: T, rect: TabRect) => void;
  /** Controls for the view shown, at the row's end. The tabs never give them room. */
  trailing?: React.ReactNode;
}

/**
 * Switches what a screen shows: text tabs at their own width, the chosen one
 * underlined. A choice inside a form is a `SegmentedControl` instead.
 */
export const ModeTabs = <T extends string>({
  options,
  value,
  onChange,
  formatLabel,
  countOf,
  tabTestID,
  onTabLayout,
  trailing,
}: ModeTabsProps<T>) => {
  const selectedIndex = Math.max(0, options.indexOf(value));
  const [spans, setSpans] = useState<readonly (Span | undefined)[]>([]);
  const target = spans[selectedIndex];

  // The resting underline derives from the selection and the measured spans, so
  // it is right on the first measured frame. The offsets are only the slide,
  // seeded with the distance back to the old tab and sprung to 0.
  const offsetX = useSharedValue(0);
  const offsetWidth = useSharedValue(0);
  const prevIndex = useSharedValue(selectedIndex);
  useLayoutEffect(() => {
    const fromIndex = prevIndex.get();
    if (fromIndex === selectedIndex) return;
    prevIndex.set(selectedIndex);
    const from = spans[fromIndex];
    if (!from || !target) return;
    offsetX.set(from.x - target.x);
    offsetWidth.set(from.width - target.width);
    offsetX.set(withSpring(0, motion.spring.GENTLE));
    offsetWidth.set(withSpring(0, motion.spring.GENTLE));
  }, [selectedIndex, spans, target, offsetX, offsetWidth, prevIndex]);

  const animatedTheme = useAnimatedTheme();
  const restX = target?.x ?? 0;
  const restWidth = target?.width ?? 0;
  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: restX + offsetX.get() }],
    width: restWidth + offsetWidth.get(),
    // Width is 0 until measured; the gate keeps it from painting at the start.
    opacity: restWidth > 0 ? 1 : 0,
    height: animatedTheme.get().borderWidth.thick,
    borderRadius: animatedTheme.get().radii.full,
    backgroundColor: animatedTheme.get().colors.primary,
  }));

  const recordSpan = (index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setSpans(current => {
      const next = [...current];
      next[index] = { x, width };
      return next;
    });
  };

  return (
    <View style={styles.row}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {options.map((option, index) => (
          <ModeTab
            key={option}
            label={formatLabel(option)}
            count={countOf?.(option)}
            selected={index === selectedIndex}
            onPress={() => {
              if (index === selectedIndex) return;
              HapticService.selection();
              onChange(option);
            }}
            onLayout={event => recordSpan(index, event)}
            onMeasure={
              onTabLayout ? rect => onTabLayout(option, rect) : undefined
            }
            testID={tabTestID?.(option)}
          />
        ))}
        <Animated.View style={[styles.underline, underlineStyle]} />
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
};

interface ModeTabProps {
  label: string;
  count: number | undefined;
  selected: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onMeasure: ((rect: TabRect) => void) | undefined;
  testID: string | undefined;
}

const ModeTab: React.FC<ModeTabProps> = ({
  label,
  count,
  selected,
  onPress,
  onLayout,
  onMeasure,
  testID,
}) => {
  const { ref, measure } = useMeasuredRect(onMeasure);
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={event => {
        onLayout(event);
        measure();
      }}
    >
      <AppPressable
        style={styles.tab}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        testID={testID}
      >
        <Text role="label" tone={selected ? 'primary' : 'secondary'}>
          {label}
        </Text>
        {count !== undefined ? (
          <Text role="label" tone={selected ? 'accent' : 'tertiary'}>
            {String(count)}
          </Text>
        ) : null}
      </AppPressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: theme.spacing.lg,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: theme.sizes.touchTarget.md,
  },
  underline: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  trailing: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
}));
