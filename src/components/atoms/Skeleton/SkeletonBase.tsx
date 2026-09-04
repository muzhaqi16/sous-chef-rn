import React, { useLayoutEffect } from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { motion } from '#/theme/foundations/motion';

interface SkeletonBaseProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  /** Shimmer animation; also suppressed under reduced motion. */
  animated?: boolean;
}

export const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
}) => {
  const shimmerTranslate = useSharedValue(0);
  const motionEnabled = useMotionEnabled();
  const shouldAnimate = animated && motionEnabled;

  useLayoutEffect(() => {
    if (shouldAnimate) {
      shimmerTranslate.set(
        withRepeat(
          withTiming(1, {
            duration: 1500,
            easing: motion.easing.plain,
          }),
          -1, // infinite
          false, // don't reverse
        ),
      );
    }

    return () => {
      cancelAnimation(shimmerTranslate);
    };
  }, [shouldAnimate, shimmerTranslate]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerTranslate.get(),
      [0, 1],
      [-300, 300], // Shimmer moves from left to right
    );

    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as DimensionValue,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      {/* UNISTYLES FIX: Wrapper pattern - static Unistyles on outer View */}
      {!!animated && (
        <View style={styles.shimmer}>
          <Animated.View style={[styles.shimmerFill, animatedStyle]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  shimmerFill: {
    width: '100%',
    height: '100%',
  },
  skeleton: {
    backgroundColor: theme.colors.surfaceVariant,
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.surface,
    opacity: 0.3,
  },
}));
