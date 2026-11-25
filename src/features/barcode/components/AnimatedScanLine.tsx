import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import Animated, {
  css,
  useAnimatedStyle,
  type CSSAnimationProperties,
} from 'react-native-reanimated';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { motion } from '#theme/motion';

/** Down the frame and back, for as long as the scanner shows. */
const sweep = (travel: number, duration: number): CSSAnimationProperties => ({
  animationName: css.keyframes({
    from: { transform: [{ translateY: 0 }] },
    to: { transform: [{ translateY: travel }] },
  }),
  animationDuration: duration,
  animationDirection: 'alternate',
  animationIterationCount: 'infinite',
  animationTimingFunction: motion.cssEasing.emphasized,
});

interface AnimatedScanLineProps {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  duration: number;
  cornerOffset?: number;
}

const AnimatedScanLine: React.FC<AnimatedScanLineProps> = ({
  left,
  top,
  width,
  height,
  color,
  duration,
  cornerOffset = 4,
}) => {
  // A loop is motion a zero duration cannot stop, and Reanimated's CSS
  // animations ignore reduce motion: the line rests at the top instead.
  const motionEnabled = useMotionEnabled();

  const animatedTheme = useAnimatedTheme();
  const lineThicknessStyle = useAnimatedStyle(() => ({
    height: animatedTheme.get().borderWidth.medium,
  }));

  // The frame's inner height, less the line itself.
  const travel = height - cornerOffset * 2 - 2;

  return (
    <View
      style={[
        styles.frame,
        {
          left: left + cornerOffset,
          top: top + cornerOffset,
          width: width - cornerOffset * 2,
          height: height - cornerOffset * 2,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.line,
          lineThicknessStyle,
          {
            backgroundColor: color,
            boxShadow: [
              {
                offsetX: 0,
                offsetY: 0,
                blurRadius: 3,
                spreadDistance: 0,
                color: `${color}CC`,
              },
            ],
          },
          motionEnabled ? sweep(travel, duration) : null,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Positioned over the camera preview; the frame's geometry comes from the
  // detected barcode bounds, so only the positioning mode is a style.
  frame: {
    position: 'absolute',
  },
  line: {
    width: '100%',
  },
});

export default AnimatedScanLine;
