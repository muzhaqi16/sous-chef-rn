import React, { useState } from 'react';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAnimatedTheme } from 'react-native-unistyles/reanimated';
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
import { standardEasing, TIMING } from '#/constants/animations';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CHECKMARK_PATH = 'M3 7.5 L6 10.5 L11 4.5';
const CHECKMARK_LENGTH = 12;

type AnimatedChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  imageUrl?: string;
};

export const AnimatedChip: React.FC<AnimatedChipProps> = ({
  label,
  selected,
  onPress,
  disabled = false,
  imageUrl,
}) => {
  const { theme } = useUnistyles();
  const animatedTheme = useAnimatedTheme();

  // Drive selection animations via shared value — only animates when selected truly changes
  const selectedProgress = useSharedValue(selected ? 1 : 0);
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    selectedProgress.set(
      withTiming(selected ? 1 : 0, {
        duration: TIMING.STANDARD,
        easing: standardEasing,
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
  }, [selectedProgress, disabled]);

  // Animated text style driven by shared value
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
  }, [selectedProgress]);

  // SVG checkmark draw-on animation driven by same shared value
  const checkmarkAnimatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: interpolate(
        selectedProgress.get(),
        [0, 1],
        [CHECKMARK_LENGTH, 0],
      ),
    };
  }, [selectedProgress]);

  // UNISTYLES FIX: Wrapper pattern - static Unistyles on outer Animated.View
  // Layout animation on outer container so Pressable doesn't conflict with it
  return (
    <Animated.View
      style={styles.container}
      layout={LinearTransition.springify().mass(0.8).damping(30).stiffness(250)}
    >
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Animated.View style={[styles.chip, animatedContainerStyle]}>
          {!!imageUrl && (
            <CachedImage uri={imageUrl} style={styles.image} displaySize={24} />
          )}
          <Animated.Text style={[styles.label, animatedTextStyle]}>
            {label}
          </Animated.Text>
          {!!selected && (
            <Animated.View
              style={styles.iconContainer}
              layout={LinearTransition}
              entering={FadeIn.duration(TIMING.STANDARD).easing(
                standardEasing.factory(),
              )}
              exiting={FadeOut.duration(TIMING.FAST).easing(
                standardEasing.factory(),
              )}
            >
              <Svg width={14} height={14} viewBox="0 0 14 14">
                <AnimatedPath
                  d={CHECKMARK_PATH}
                  stroke={theme.colors.primary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray={CHECKMARK_LENGTH}
                  animatedProps={checkmarkAnimatedProps}
                />
              </Svg>
            </Animated.View>
          )}
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
    borderRadius: theme.radii['2xl'],
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    borderWidth: 1.5,
  },
  image: {
    width: theme.sizes.icon.md,
    height: theme.sizes.icon.md,
    borderRadius: theme.radii.lg,
    marginRight: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: theme.fonts.weight.semibold,
  },
  iconContainer: {
    marginLeft: theme.spacing.sm,
  },
}));
