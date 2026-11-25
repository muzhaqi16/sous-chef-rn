import React from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  css,
  type CSSAnimationProperties,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { motion } from '#theme/motion';

// A loop's period is longer than the motion scale, so it stays a literal.
const SWEEP: CSSAnimationProperties = {
  animationName: css.keyframes({
    from: { transform: [{ translateX: -300 }] },
    to: { transform: [{ translateX: 300 }] },
  }),
  animationDuration: 1500,
  animationIterationCount: 'infinite',
  animationTimingFunction: motion.cssEasing.plain,
};

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
  // A loop is motion a zero duration cannot stop, and Reanimated's CSS
  // animations ignore reduce motion: the sweep is not mounted at all.
  const motionEnabled = useMotionEnabled();
  const shouldAnimate = animated && motionEnabled;

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
      {/* The sweep never rests, so its colour sits on a child: the animated
          node takes no themed style. */}
      {!!shouldAnimate && (
        <View style={styles.shimmer}>
          <Animated.View style={[styles.shimmer, SWEEP]}>
            <View style={styles.shimmerFill} />
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  shimmerFill: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    opacity: 0.3,
  },
  skeleton: {
    backgroundColor: theme.colors.borderLight,
    overflow: 'hidden',
  },
  shimmer: {
    width: '100%',
    height: '100%',
  },
}));
