import React from 'react';
import { TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Icon } from '#/utils';
import type { StepDotProps } from './types';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const StepDot: React.FC<StepDotProps> = ({
  index,
  activeIndex,
  stepSize,
  step: _step,
  onPress,
  allowNavigation = false,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    const isCompleted = activeIndex.value > index;
    const isPending = activeIndex.value < index;

    // Color transitions
    const backgroundColor = interpolateColor(
      activeIndex.value,
      [index - 1, index, index + 1],
      ['#E5E7EB', '#3B82F6', '#E5E7EB'] // gray, blue, gray
    );

    const borderColor = interpolateColor(
      activeIndex.value,
      [index - 1, index, index + 1],
      ['#E5E7EB', '#3B82F6', '#E5E7EB']
    );

    // Scale animation for active step
    const scale = withTiming(isActive ? 1.1 : 1, { duration: 200 });

    // Opacity for completed steps
    const opacity = withTiming(isCompleted ? 1 : isPending ? 0.6 : 1, { duration: 200 });

    return {
      backgroundColor: withTiming(
        isCompleted ? '#10B981' : backgroundColor, // green for completed
        { duration: 300 }
      ),
      borderColor: withTiming(
        isCompleted ? '#10B981' : borderColor,
        { duration: 300 }
      ),
      transform: [{ scale }],
      opacity,
    };
  }, [index]);

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const isCompleted = activeIndex.value > index;
    const opacity = withTiming(isCompleted ? 1 : 0, { duration: 200 });
    const scale = withTiming(isCompleted ? 1 : 0, { duration: 200 });

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

  return (
    <AnimatedTouchableOpacity
      style={[
        styles.stepDot,
        {
          width: stepSize,
          height: stepSize,
          borderRadius: stepSize / 2,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      disabled={!allowNavigation}
      activeOpacity={allowNavigation ? 0.7 : 1}
    >
      <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
        <Icon name="check" size={stepSize * 0.5} color="white" />
      </Animated.View>
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  stepDot: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  iconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
}));