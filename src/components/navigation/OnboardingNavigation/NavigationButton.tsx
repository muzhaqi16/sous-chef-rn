import React from 'react';

import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
  const { theme } = useUnistyles();

  return (
    <AnimatedPressable
      onPress={action.onPress}
      disabled={action.disabled}
      style={({ pressed }) => [
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
        size="lg"
        weight="semibold"
        align="center"
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
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
