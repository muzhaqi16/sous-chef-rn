import React, { useLayoutEffect } from 'react';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  useReducedMotion,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface SwipeHandIndicatorProps {
  direction: 'left' | 'right';
  /** SharedValue 0..1 controlling visibility (1 = visible, 0 = hidden) */
  visible: SharedValue<number>;
}

/**
 * Animated finger emoji that bounces in the swipe direction.
 * Fades out when the user starts interacting.
 */
export const SwipeHandIndicator: React.FC<SwipeHandIndicatorProps> = ({
  direction,
  visible,
}) => {
  const translateX = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const distance = direction === 'left' ? -30 : 30;
    translateX.set(
      withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(distance, {
              duration: 600,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, // infinite
          false,
        ),
      ),
    );

    return () => {
      cancelAnimation(translateX);
    };
  }, [translateX, direction, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
    opacity: visible.get(),
  }));

  // Use finger emoji — more intuitive for "swipe here" than Ionicons hand icons
  const emoji = direction === 'left' ? '👈' : '👉';

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text size="4xl">{emoji}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
  },
}));
