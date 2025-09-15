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
}

const AnimatedScanLine: React.FC<AnimatedScanLineProps> = ({
  left,
  top,
  width,
  height,
  color,
  duration,
}) => {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withRepeat(withTiming(1, {duration}), -1, true);
  }, [animatedValue, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      animatedValue.value,
      [0, 1],
      [0, height - 2],
    );

    return {
      transform: [{translateY}],
    };
  });

  return (
    <View
      style={{
        position: 'absolute',
        left: left + 10,
        top: top + 10,
        width: width - 20,
        height: height - 20,
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
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

export default AnimatedScanLine;
