import React from 'react';
import type {
  PressableProps,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from '#components/atoms/themedComponents';

import { HapticService } from '#services/haptic/HapticService';
import { motion } from '#/theme/foundations/motion';

// Module scope — `createAnimatedComponent` must never be called per render.
// Built on RN's `Pressable` (the themedComponents re-export, auto-bound to the
// Unistyles ShadowTree) — NOT RNGH's Pressable and NOT `withUnistyles`.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleHaptic = 'light' | 'medium' | 'selection' | 'none';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /**
   * Static or array form only — a Reanimated animated style cannot live inside
   * the `({ pressed }) => …` callback form.
   */
  style?: StyleProp<ViewStyle>;
  /** Pressed scale target. Default `0.97` (the app's button standard). */
  activeScale?: number;
  /** Haptic to fire on press. Default `'none'` (opt-in). */
  haptic?: PressableScaleHaptic;
}

/**
 * Scale sibling of `AppPressable`: springs to `activeScale` on the UI thread.
 * The press handlers are JS-thread RN events, not worklets, so no `scheduleOnRN`
 * is involved. Do NOT use inside a Swipeable underlay or `GestureDetector`
 * chain — RNGH's own `Pressable` belongs there.
 */
export const PressableScale: React.FC<PressableScaleProps> = ({
  style,
  activeScale = 0.97,
  haptic = 'none',
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePressIn = (event: GestureResponderEvent) => {
    scale.set(withSpring(activeScale, motion.spring.PRESS));
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    scale.set(withSpring(1, motion.spring.PRESS));
    onPressOut?.(event);
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (haptic === 'light') HapticService.light();
    else if (haptic === 'medium') HapticService.medium();
    else if (haptic === 'selection') HapticService.selection();
    onPress?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPress={onPress ? handlePress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
};
