import React, { useLayoutEffect } from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  cancelAnimation,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

interface SkeletonBaseProps {
  /** Width of the skeleton (number or percentage string) */
  width?: number | string;
  /** Height of the skeleton */
  height?: number;
  /** Border radius */
  borderRadius?: number;
  /** Additional style */
  style?: ViewStyle;
  /** Whether to show the shimmer animation */
  animated?: boolean;
}

/**
 * Base Skeleton Component
 *
 * Provides a loading placeholder with optional shimmer animation.
 * This is the foundation for all skeleton components.
 *
 * @example
 * ```typescript
 * <SkeletonBase width={200} height={20} borderRadius={4} />
 * <SkeletonBase width="100%" height={40} animated={true} />
 * ```
 */
export const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
}) => {
  const shimmerTranslate = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animated && !reducedMotion;

  useLayoutEffect(() => {
    if (shouldAnimate) {
      shimmerTranslate.set(
        withRepeat(
          withTiming(1, {
            duration: 1500,
            easing: Easing.ease,
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
          <Animated.View
            style={[{ width: '100%', height: '100%' }, animatedStyle]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
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
