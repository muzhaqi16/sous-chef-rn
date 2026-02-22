import React from 'react';
import { Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  LinearTransition,
} from 'react-native-reanimated';
import type { NavigationButtonProps } from './types';

const AnimatedText = Animated.createAnimatedComponent(Text);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const LayoutTransitionDefault = LinearTransition.duration(250);

export const NavigationButton: React.FC<NavigationButtonProps> = ({
  action,
  style,
  textStyle,
}) => {
  const { theme } = useUnistyles();

  return (
    <AnimatedPressable
      onPress={action.onPress}
      disabled={action.disabled}
      style={({pressed}) => [
        styles.button,
        {
          backgroundColor: action.backgroundColor,
          opacity: action.disabled ? theme.opacity.disabled : 1,
        },
        style,
        pressed && styles.pressed,
      ]}
      layout={LayoutTransitionDefault}
    >
      <AnimatedText
        layout={action.iconVisible ? LayoutTransitionDefault : undefined}
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: action.labelColor || theme.colors.white,
          },
          textStyle,
        ]}
      >
        {!!action.iconVisible && action.icon}
        {action.label}
      </AnimatedText>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    height: theme.sizes.button.lg + 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xl,
  },
  label: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));