import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
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
            color: action.labelColor || '#FFFFFF',
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

const styles = StyleSheet.create(_theme => ({
  button: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    borderCurve: 'continuous',
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
}));