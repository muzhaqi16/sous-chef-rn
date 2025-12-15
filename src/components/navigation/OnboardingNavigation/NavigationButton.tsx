import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  LinearTransition,
} from 'react-native-reanimated';
import type { NavigationButtonProps } from './types';

const AnimatedText = Animated.createAnimatedComponent(Text);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const LayoutTransitionDefault = LinearTransition.duration(250);

export const NavigationButton: React.FC<NavigationButtonProps> = ({
  action,
  style,
  textStyle,
}) => {
  const { theme } = useUnistyles();

  return (
    <AnimatedTouchableOpacity
      onPress={action.onPress}
      disabled={action.disabled}
      style={[
        styles.button,
        {
          backgroundColor: action.backgroundColor,
          opacity: action.disabled ? 0.6 : 1,
        },
        style,
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
        {action.iconVisible && action.icon}
        {action.label}
      </AnimatedText>
    </AnimatedTouchableOpacity>
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
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
}));