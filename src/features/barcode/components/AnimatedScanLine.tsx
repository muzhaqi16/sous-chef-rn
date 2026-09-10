import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';

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
  const animatedValue = useSharedValue(0);
  const motionEnabled = useMotionEnabled();

  useLayoutEffect(() => {
    if (!motionEnabled) return;
    animatedValue.set(withRepeat(withTiming(1, { duration }), -1, true));
    return () => {
      cancelAnimation(animatedValue);
    };
  }, [animatedValue, duration, motionEnabled]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      animatedValue.get(),
      [0, 1],
      [0, height - cornerOffset * 2 - 2], // Account for corner offset and line height
    );

    return {
      transform: [{ translateY }],
    };
  });

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
          animatedStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  // Positioned over the camera preview; the frame's geometry comes from the
  // detected barcode bounds, so only the positioning mode is a style.
  frame: {
    position: 'absolute',
  },
  line: {
    height: theme.borderWidth.medium,
    width: '100%',
  },
}));

export default AnimatedScanLine;
