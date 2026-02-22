import React, { useEffect } from 'react';
import { StyleProp, ViewStyle, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import IconButton from './IconButton';
import { standardEasing, TIMING } from '#/constants/animations';

type AnimatedActionButtonProps = {
  onPress: () => void;
  name?: string;
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  accessibilityLabel?: string;
  backgroundColor?: string;
  isHighlighted?: boolean; // Triggers animation when true
  testID?: string;
};

export const AnimatedActionButton: React.FC<AnimatedActionButtonProps> = ({
  onPress,
  name,
  style,
  color,
  size = 'md',
  accessibilityLabel,
  backgroundColor,
  isHighlighted = false,
  testID,
}) => {
  const { theme } = useUnistyles();
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  // Animate icon scale and rotation when isHighlighted changes to true
  useEffect(() => {
    if (isHighlighted) {
      // Pulse animation with rotation
      scale.set(withSequence(
        withTiming(1.1, { duration: TIMING.STANDARD }),
        withTiming(1, { duration: TIMING.STANDARD }),
      ));
      rotation.set(withSequence(
        withTiming(1, { duration: TIMING.STANDARD }),
        withTiming(0, { duration: TIMING.STANDARD }),
      ));
    }
  }, [isHighlighted, scale, rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 1], [0, 90]);

    return {
      backgroundColor: withTiming(backgroundColor || theme.colors.surface, {
        duration: TIMING.FAST,
        easing: standardEasing,
      }),
      transform: [{ scale: scale.value }, { rotate: `${rotate}deg` }],
    };
  });

  // Wrapper pattern: static Unistyles on outer View, animated styles on inner Animated.View
  return (
    <View style={[styles.button, style]} testID={testID}>
      <Animated.View style={[styles.animatedInner, animatedStyle]}>
        <IconButton
          name={name || 'add'}
          size={size}
          color={color || theme.colors.primary}
          onPress={onPress}
          accessibilityLabel={accessibilityLabel || `${name || 'Add'} button`}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    width: 44,
    height: 44,
    borderColor: theme.colors.primary,
    borderWidth: 2,
    overflow: 'hidden', // Clip animated background to border radius
  },
  animatedInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
