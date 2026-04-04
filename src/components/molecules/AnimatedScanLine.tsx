import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';

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

  useLayoutEffect(() => {
    animatedValue.set(withRepeat(withTiming(1, { duration }), -1, true));
    return () => {
      cancelAnimation(animatedValue);
    };
  }, [animatedValue, duration]);

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
      style={{
        position: 'absolute',
        left: left + cornerOffset,
        top: top + cornerOffset,
        width: width - cornerOffset * 2,
        height: height - cornerOffset * 2,
      }}
    >
      <Animated.View
        style={[
          {
            height: 2,
            backgroundColor: color,
            width: '100%',
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

export default AnimatedScanLine;
