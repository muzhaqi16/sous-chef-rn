import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon, type IconName } from '#components/atoms/Icon';
import { ThemeEpochSentinel } from '#components/atoms/ThemeEpochSentinel';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { CachedImage } from '#components/atoms/CachedImage';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { HapticService } from '#services/haptic/HapticService';
import { motion } from '#theme/motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CHECKMARK_PATH = 'M3 7.5 L6 10.5 L11 4.5';
const CHECKMARK_LENGTH = 12;

// Layout animation builders defined at module scope to avoid per-render
// allocation in list contexts. Reanimated docs explicitly recommend this.
const CHIP_LAYOUT_TRANSITION = LinearTransition.springify()
  .mass(0.8)
  .damping(30)
  .stiffness(250);
const CHECK_LAYOUT_TRANSITION = LinearTransition;
const CHECK_ENTERING = FadeIn.duration(motion.timing.STANDARD).easing(
  motion.easing.standard.factory(),
);
const CHECK_EXITING = FadeOut.duration(motion.timing.FAST).easing(
  motion.easing.standard.factory(),
);

type ChipProps = {
  label: string;
  onPress: () => void;
  /**
   * A filter chip, single- or multi-select alike: selected draws the check
   * (Material 3's filter chip). Left out, the chip is an action.
   */
  selected?: boolean;
  /** An input chip: pressing it removes it, and a trailing close says so. */
  removable?: boolean;
  icon?: IconName;
  disabled?: boolean;
  imageUrl?: string;
  /** As tall as a chip with a photo, for a list where some have none. */
  reserveImageHeight?: boolean;
  /** Defaults to the label; a removable chip names what pressing removes. */
  accessibilityLabel?: string;
  testID?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** The kit's one chip: its selection, haptic and radius are the same everywhere. */
export const Chip: React.FC<ChipProps> = ({
  label,
  onPress,
  selected,
  removable = false,
  icon,
  disabled = false,
  imageUrl,
  reserveImageHeight = false,
  accessibilityLabel,
  testID,
  onLayout,
}) => {
  const isSelected = selected === true;
  const animatedTheme = useAnimatedTheme();

  // Drive selection animations via shared value — only animates when selected truly changes
  const selectedProgress = useSharedValue(isSelected ? 1 : 0);
  const [prevSelected, setPrevSelected] = useState(isSelected);
  if (isSelected !== prevSelected) {
    setPrevSelected(isSelected);
    selectedProgress.set(
      withTiming(isSelected ? 1 : 0, {
        duration: motion.timing.STANDARD,
        easing: motion.easing.standard,
      }),
    );
  }

  const handlePress = () => {
    if (disabled) return;
    HapticService.light();
    onPress();
  };

  // Animated container style driven by shared value
  // paddingRight is fixed — the LinearTransition layout animation handles spacing
  // when the checkmark icon appears/disappears, avoiding non-GPU layout recalc.
  const chipSurfaceStyle = useAnimatedStyle(() => {
    const theme = animatedTheme.get();
    return {
      borderRadius: theme.radii['2xl'],
      borderWidth: theme.borderWidth.thin,
      paddingVertical: theme.spacing.xsPlus,
      paddingHorizontal: theme.spacing.sm,
      minHeight: reserveImageHeight
        ? theme.sizes.icon.md +
          2 * (theme.spacing.xsPlus + theme.borderWidth.thin)
        : 0,
    };
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(
        selectedProgress.get(),
        [0, 1],
        [animatedTheme.get().colors.border, animatedTheme.get().colors.primary],
      ),
      backgroundColor: interpolateColor(
        selectedProgress.get(),
        [0, 1],
        [
          animatedTheme.get().colors.chipBackground,
          animatedTheme.get().colors.primaryLight,
        ],
      ),
      opacity: disabled ? animatedTheme.get().opacity.disabled : 1,
    };
  });

  // Animated text style driven by shared value
  const labelTypeStyle = useAnimatedStyle(() => ({
    ...animatedTheme.get().type.label,
  }));

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        selectedProgress.get(),
        [0, 1],
        [
          animatedTheme.get().colors.chipText,
          animatedTheme.get().colors.primary,
        ],
      ),
    };
  });

  // SVG checkmark draw-on animation driven by same shared value.
  // Stroke color is read from animatedTheme so it stays reactive without a
  // useUnistyles() subscription on the parent.
  const checkmarkAnimatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: interpolate(
        selectedProgress.get(),
        [0, 1],
        [CHECKMARK_LENGTH, 0],
      ),
      stroke: animatedTheme.get().colors.primary,
    };
  });

  // Layout animation on outer container so Pressable doesn't conflict with it
  return (
    <Animated.View
      style={styles.container}
      layout={CHIP_LAYOUT_TRANSITION}
      onLayout={onLayout}
    >
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={
          selected === undefined ? { disabled } : { selected, disabled }
        }
        testID={testID}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Animated.View
          style={[styles.chip, chipSurfaceStyle, animatedContainerStyle]}
        >
          {/* The icons below are themed, under an animated surface. */}
          <ThemeEpochSentinel />
          {!!icon && (
            <View style={styles.leadingIcon}>
              <Icon
                name={icon}
                size="xs"
                tone={isSelected ? 'primary' : 'textSecondary'}
              />
            </View>
          )}
          {!!imageUrl && (
            <CachedImage uri={imageUrl} style={styles.image} displaySize={24} />
          )}
          <Animated.Text style={[labelTypeStyle, animatedTextStyle]}>
            {label}
          </Animated.Text>
          {removable ? (
            <View style={styles.iconContainer}>
              <Icon name="close-circle" size="xs" tone="textSecondary" />
            </View>
          ) : null}
          {isSelected ? (
            <Animated.View
              style={styles.iconContainer}
              layout={CHECK_LAYOUT_TRANSITION}
              entering={CHECK_ENTERING}
              exiting={CHECK_EXITING}
            >
              <Svg width={14} height={14} viewBox="0 0 14 14">
                <AnimatedPath
                  d={CHECKMARK_PATH}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray={CHECKMARK_LENGTH}
                  animatedProps={checkmarkAnimatedProps}
                />
              </Svg>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    margin: 0,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  chip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  image: {
    width: theme.sizes.icon.md,
    height: theme.sizes.icon.md,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    marginRight: theme.spacing.sm,
  },
  iconContainer: {
    marginLeft: theme.spacing.sm,
  },
  leadingIcon: {
    marginRight: theme.spacing.xs,
  },
}));
