import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import IconButton from './IconButton';

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
      scale.value = withSequence(
        withTiming(1.1, { duration: 200 }),
        withTiming(1, { duration: 200 }),
      );
      rotation.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 200 }),
      );
    }
  }, [isHighlighted, scale, rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 1], [0, 90]);

    return {
      backgroundColor: withTiming(backgroundColor || theme.colors.surface, {
        duration: 150,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
      transform: [{ scale: scale.value }, { rotate: `${rotate}deg` }],
    };
  });

  return (
    <Animated.View style={[styles.button, animatedStyle, style]} testID={testID}>
      <IconButton
        name={name || 'add'}
        size={size}
        color={color || theme.colors.primary}
        onPress={onPress}
        library="Ionicons"
        accessibilityLabel={accessibilityLabel || `${name || 'Add'} button`}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    borderRadius: 16,
    width: 44,
    height: 44,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
}));
