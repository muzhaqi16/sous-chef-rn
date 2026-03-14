import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAnimatedTheme } from 'react-native-unistyles/reanimated';
import { TIMING } from '#constants/animations';
import { Icon } from '#/utils/iconUtils';
import type { StepDotProps } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const StepDot: React.FC<StepDotProps> = ({
  index,
  activeIndex,
  stepSize,
  onPress,
  allowNavigation = false,
}) => {
  const { theme } = useUnistyles();
  const animatedTheme = useAnimatedTheme();

  // Animated style for color transitions, scale, and opacity
  // Static layout properties are in StyleSheet to avoid 'as const' casts
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    const isCompleted = activeIndex.value > index;
    const isPending = activeIndex.value < index;

    // Color transitions - using animated theme colors
    const backgroundColor = interpolateColor(
      activeIndex.value,
      [index - 1, index, index + 1],
      [
        animatedTheme.value.colors.border,
        animatedTheme.value.colors.primary,
        animatedTheme.value.colors.border,
      ],
    );

    const borderColor = interpolateColor(
      activeIndex.value,
      [index - 1, index, index + 1],
      [
        animatedTheme.value.colors.border,
        animatedTheme.value.colors.primary,
        animatedTheme.value.colors.border,
      ],
    );

    // Scale animation for active step
    const scale = withTiming(isActive ? 1.1 : 1, { duration: TIMING.STANDARD });

    // Opacity for completed steps
    const opacity = withTiming(isCompleted ? 1 : isPending ? 0.6 : 1, {
      duration: TIMING.STANDARD,
    });

    return {
      // Size-dependent properties (from prop)
      width: stepSize,
      height: stepSize,
      borderRadius: stepSize / 2,
      // Animated properties
      backgroundColor: withTiming(
        isCompleted ? animatedTheme.value.colors.success : backgroundColor,
        { duration: TIMING.SLOW },
      ),
      borderColor: withTiming(
        isCompleted ? animatedTheme.value.colors.success : borderColor,
        { duration: TIMING.SLOW },
      ),
      transform: [{ scale }],
      opacity,
    };
  }, [index, stepSize]);

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const isCompleted = activeIndex.value > index;
    const opacity = withTiming(isCompleted ? 1 : 0, {
      duration: TIMING.STANDARD,
    });
    const scale = withTiming(isCompleted ? 1 : 0, {
      duration: TIMING.STANDARD,
    });

    return {
      opacity,
      transform: [{ scale }],
    };
  }, [index]);

  const handlePress = () => {
    if (allowNavigation && onPress) {
      onPress(index);
    }
  };

  // Use single static style + animatedStyle to avoid "2 unistyles styles" warning
  return (
    <AnimatedPressable
      style={[styles.stepDot, animatedStyle]}
      onPress={handlePress}
      disabled={!allowNavigation}
    >
      <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
        <Icon
          name="checkmark"
          size={stepSize * 0.5}
          color={theme.colors.white}
        />
      </Animated.View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create(() => ({
  stepDot: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  iconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
}));
