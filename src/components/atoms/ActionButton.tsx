import React, { useLayoutEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { IconButton } from '#components/atoms/IconButton';
import { motion } from '#/theme/foundations/motion';

type ActionButtonProps = {
  onPress: () => void;
  name: string;
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** What the button does; its icon's name is no label. */
  accessibilityLabel: string;
  /** Fill behind the glyph. Animated, so a caller can flip it on a state. */
  backgroundColor?: string;
  /** Pulses and quarter-turns the glyph once, to draw the eye to a change. */
  isHighlighted?: boolean;
  testID?: string;
};

/**
 * A bordered circular icon action. The pulse is inert until `isHighlighted`
 * flips, so the still and animated forms are one component.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
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
  const animatedTheme = useAnimatedTheme();
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  useLayoutEffect(() => {
    if (!isHighlighted) return;
    scale.set(
      withSequence(
        withTiming(1.1, { duration: motion.timing.STANDARD }),
        withTiming(1, { duration: motion.timing.STANDARD }),
      ),
    );
    rotation.set(
      withSequence(
        withTiming(1, { duration: motion.timing.STANDARD }),
        withTiming(0, { duration: motion.timing.STANDARD }),
      ),
    );
  }, [isHighlighted, scale, rotation]);

  // The border and the fill are one view's: drawn on two, Android anti-aliases
  // each edge apart and the sheet behind shows through the seam as a dark ring.
  const fillStyle = useAnimatedStyle(() => {
    const theme = animatedTheme.get();
    return {
      backgroundColor: withTiming(backgroundColor ?? theme.colors.surface, {
        duration: motion.timing.FAST,
        easing: motion.easing.standard,
      }),
      borderColor: theme.colors.primary,
      borderWidth: theme.borderWidth.medium,
      borderRadius: theme.radii.xl,
    };
  });
  const glyphStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.get(), [0, 1], [0, 90]);
    return { transform: [{ scale: scale.get() }, { rotate: `${rotate}deg` }] };
  });

  return (
    <View style={[styles.button, style]}>
      <Animated.View style={[styles.fill, fillStyle]}>
        <Animated.View style={glyphStyle}>
          <IconButton
            name={name}
            size={size}
            tone="primary"
            color={color}
            onPress={onPress}
            testID={testID}
            accessibilityLabel={accessibilityLabel}
          />
        </Animated.View>
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
    borderCurve: 'continuous',
    width: theme.sizes.button.md,
    height: theme.sizes.button.md,
  },
  fill: {
    alignSelf: 'stretch',
    flex: 1,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
