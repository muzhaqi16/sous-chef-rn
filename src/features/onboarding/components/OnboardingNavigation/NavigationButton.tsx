import React from 'react';
import type { PressableStateCallbackType } from 'react-native';

import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import type { NavigationButtonProps } from './types';
import { Text } from '#components/atoms/Text';

const AnimatedText = Animated.createAnimatedComponent(Text);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const LayoutTransitionDefault = LinearTransition.duration(TIMING.MODERATE);

export const NavigationButton: React.FC<NavigationButtonProps> = ({
  action,
  style,
  textStyle,
}) => {
  styles.useVariants({ disabled: action.disabled ?? false });

  return (
    <AnimatedPressable
      onPress={action.onPress}
      disabled={action.disabled}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.button,
        !!action.backgroundColor && {
          backgroundColor: action.backgroundColor,
        },
        style,
        pressed && styles.pressed,
      ]}
      layout={LayoutTransitionDefault}
    >
      <AnimatedText
        size="lg"
        weight="semibold"
        align="center"
        layout={action.iconVisible ? LayoutTransitionDefault : undefined}
        numberOfLines={1}
        style={[
          styles.label,
          !!action.labelColor && { color: action.labelColor },
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
    variants: {
      disabled: {
        true: { opacity: theme.opacity.disabled },
        false: { opacity: 1 },
      },
    },
  },
  label: {
    letterSpacing: 0.5,
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
