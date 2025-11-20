import React, { useEffect } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import type { IconLibrary } from '#utils/iconUtils';

interface AnimatedSwipeIconProps {
  /** Icon name */
  icon?: string;
  /** Icon library */
  library?: IconLibrary;
  /** Icon size */
  size?: number;
  /** Icon color */
  color?: string;
  /** Swipe direction: 'left' or 'right' */
  direction?: 'left' | 'right';
  /** Animation distance in pixels */
  distance?: number;
  /** Number of times to repeat animation */
  repeatCount?: number;
  /** Delay before starting animation */
  delay?: number;
}

/**
 * Reusable animated swipe icon component for feature hints
 */
export const AnimatedSwipeIcon: React.FC<AnimatedSwipeIconProps> = ({
  icon,
  library = 'MaterialIcons',
  size = 32,
  color,
  direction = 'left',
  distance = 40,
  repeatCount = 3,
  delay = 500,
}) => {
  const { theme } = useUnistyles();
  const translateX = useSharedValue(0);
  const iconColor = color || theme.colors.primary;

  // Use direction-appropriate arrow if no custom icon provided
  const iconName = icon || (direction === 'left' ? 'arrow-back' : 'arrow-forward');

  useEffect(() => {
    const swipeDistance = direction === 'left' ? -distance : distance;

    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(swipeDistance, {
            duration: 600,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        repeatCount,
        false,
      ),
    );
  }, [translateX, direction, distance, repeatCount, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.iconContainer, animatedStyle]}>
      <Icon name={iconName} size={size} color={iconColor} library={library} />
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  iconContainer: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.full,
  },
}));
