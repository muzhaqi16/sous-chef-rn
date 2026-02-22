import React, {useEffect} from 'react';
import {View} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
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

  useEffect(() => {
    animatedValue.set(withRepeat(withTiming(1, {duration}), -1, true));
  }, [animatedValue, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      animatedValue.value,
      [0, 1],
      [0, height - (cornerOffset * 2) - 2], // Account for corner offset and line height
    );

    return {
      transform: [{translateY}],
    };
  });

  return (
    <View
      style={{
        position: 'absolute',
        left: left + cornerOffset,
        top: top + cornerOffset,
        width: width - (cornerOffset * 2),
        height: height - (cornerOffset * 2),
      }}>
      <Animated.View
        style={[
          {
            height: 2,
            backgroundColor: color,
            width: '100%',
            shadowColor: color,
            shadowOffset: {width: 0, height: 0},
            shadowOpacity: 0.8,
            shadowRadius: 3,
            elevation: 2, // For Android shadow
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

export default AnimatedScanLine;
