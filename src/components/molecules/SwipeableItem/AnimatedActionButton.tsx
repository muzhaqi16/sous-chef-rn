import React, { useMemo, useCallback } from 'react';
import { Text, Animated, Pressable } from 'react-native';
import { Icon } from '#utils/iconUtils';
import { styles } from './styles';
import { useUnistyles } from 'react-native-unistyles';
import { ActionButtonProps } from './types';

interface AnimatedActionButtonProps extends ActionButtonProps {
  progress?: Animated.AnimatedInterpolation<number>;
  /** The index of this button (0, 1, 2...) for stagger calculation */
  index?: number;
}

export const AnimatedActionButton: React.FC<AnimatedActionButtonProps> = ({
  onPress,
  icon,
  label,
  circular = false,
  library,
  testID,
  progress,
  index = 0,
}) => {
  const { theme } = useUnistyles();

  const buttonStyle = circular
    ? styles.circularActionButton
    : styles.actionButton;
  const iconColor = theme.colors.white;
  const iconSize = theme.fonts.size.xl;

  // Calculate stagger thresholds - buttons reveal sequentially as swipe progresses
  // First button starts appearing at 0.1, fully visible at 0.3
  // Second button starts at 0.25, fully visible at 0.5
  // Third button starts at 0.4, fully visible at 0.7
  const startThreshold = 0.1 + index * 0.15;
  const endThreshold = startThreshold + 0.25;

  // PERFORMANCE: Use RN Animated API instead of Reanimated for better list performance
  const animatedStyle = useMemo(() => {
    if (!progress) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }

    return {
      opacity: progress.interpolate({
        inputRange: [startThreshold, endThreshold],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [startThreshold, endThreshold],
            outputRange: [0.5, 1],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }, [progress, startThreshold, endThreshold]);

  // PERFORMANCE: Memoize the press handler
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  // PERFORMANCE: Use Pressable instead of GestureDetector + Gesture.Tap()
  // Pressable is lighter weight and sufficient for simple tap actions
  // The parent Swipeable already handles gesture coordination
  return (
    <Pressable onPress={handlePress} style={buttonStyle} testID={testID}>
      <Animated.View style={animatedStyle}>
        <Icon name={icon} size={iconSize} color={iconColor} library={library} />
        {label && <Text style={styles.deleteText}>{label}</Text>}
      </Animated.View>
    </Pressable>
  );
};
