import React from 'react';

// RNGH's Pressable (not the themed RN re-export). The action button sits in
// RNGH Swipeable's underlay; RN's Pressable doesn't register with RNGH's
// gesture coordinator, so taps on the revealed action are silently dropped.
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { withUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { styles } from './styles';
import { ActionButtonProps } from './types';
import { Text } from '#components/atoms/Text';

const ThemedIcon = withUnistyles(Icon, theme => ({
  color: theme.colors.white,
  size: theme.fonts.size.xl,
}));

interface SwipeActionButtonProps extends ActionButtonProps {
  progress?: SharedValue<number>;
  /** The index of this button (0, 1, 2...) for stagger calculation */
  index?: number;
}

const SwipeActionButtonComponent: React.FC<SwipeActionButtonProps> = ({
  onPress,
  icon,
  label,
  circular = false,
  library,
  testID,
  progress,
  index = 0,
}) => {
  const buttonStyle = circular
    ? styles.circularActionButton
    : styles.actionButton;

  // Calculate stagger thresholds - buttons reveal sequentially as swipe progresses
  // First button starts appearing at 0.1, fully visible at 0.3
  // Second button starts at 0.25, fully visible at 0.5
  // Third button starts at 0.4, fully visible at 0.7
  const start = 0.1 + index * 0.15;
  const { startThreshold, endThreshold } = {
    startThreshold: start,
    endThreshold: start + 0.25,
  };

  // Use Reanimated's useAnimatedStyle for SharedValue-based animations
  const animatedStyle = useAnimatedStyle(() => {
    if (!progress) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }

    const opacity = interpolate(
      progress.get(),
      [startThreshold, endThreshold],
      [0, 1],
      Extrapolation.CLAMP,
    );

    const scale = interpolate(
      progress.get(),
      [startThreshold, endThreshold],
      [0.5, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  }, [progress, startThreshold, endThreshold]);

  const handlePress = () => {
    onPress();
  };

  // RNGH Pressable (see import comment) instead of GestureDetector + Gesture.Tap()
  // — lighter weight and sufficient for simple tap actions on a Swipeable underlay.
  return (
    <Pressable onPress={handlePress} style={buttonStyle} testID={testID}>
      <Animated.View style={animatedStyle}>
        <ThemedIcon name={icon} library={library} />
        {label ? (
          <Text size="xs" weight="semibold" style={styles.deleteText}>
            {label}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
};

export const SwipeActionButton = SwipeActionButtonComponent;
