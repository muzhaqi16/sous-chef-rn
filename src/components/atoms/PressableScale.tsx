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
import { SPRING } from '#constants/animations';
import { HapticService } from '#services/haptic/HapticService';

// Module scope — `createAnimatedComponent` must never be called per render.
// Built on RN's `Pressable` (the themedComponents re-export, auto-bound to the
// Unistyles ShadowTree) — NOT RNGH's Pressable and NOT `withUnistyles`.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleHaptic = 'light' | 'medium' | 'selection' | 'none';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /**
   * Caller style — static or array form only. The animated scale transform is
   * appended via the array pattern, preserving caller-owned themed/`useVariants`
   * styles. (The `({ pressed }) => …` function form is intentionally unsupported:
   * a Reanimated animated style cannot live inside a function-style callback.)
   */
  style?: StyleProp<ViewStyle>;
  /** Pressed scale target. Default `0.97` (the app's button standard). */
  activeScale?: number;
  /** Haptic to fire on press. Default `'none'` (opt-in). */
  haptic?: PressableScaleHaptic;
}

/**
 * Canonical scale press-feedback surface: springs to `activeScale` on press-in
 * and back on release, on the UI thread. The scale sibling of `AppPressable`
 * (which does opacity). Use for buttons/FABs that should "press in" rather than
 * dim.
 *
 * `onPressIn`/`onPressOut`/`onPress` are JS-thread RN events (not worklets), so
 * `scale.set(withSpring(...))` and the haptic run on the JS thread — no
 * `scheduleOnRN`, no worklet boundary. Do NOT use inside a Swipeable underlay or
 * `GestureDetector` chain (use RNGH's `Pressable` there instead).
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
    scale.set(withSpring(activeScale, SPRING.PRESS));
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    scale.set(withSpring(1, SPRING.PRESS));
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
