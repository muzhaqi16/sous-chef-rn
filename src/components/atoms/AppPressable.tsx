import React from 'react';
import type {
  PressableProps,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { HapticService } from '#services/haptic/HapticService';
import { RIPPLE } from '#constants/ripple';

type PressableStyleFn = (state: { pressed: boolean }) => StyleProp<ViewStyle>;

export interface AppPressableProps extends Omit<PressableProps, 'style'> {
  /**
   * Caller style — a static style/array OR the RN function form. Whatever it
   * resolves to, the standard `pressed` feedback is APPENDED to it, so any
   * caller-owned `useVariants` styles are preserved (never replaced).
   */
  style?: StyleProp<ViewStyle> | PressableStyleFn;
  /** Visual press feedback. `'opacity'` dims to `theme.opacity.pressed`. Default `'opacity'`. */
  feedback?: 'opacity' | 'none';
  /** Fire `HapticService.selection()` on press. Default `false` (opt-in). */
  haptic?: boolean;
  /** Add a subtle Android ripple (`RIPPLE.SUBTLE`). Default `false` (opt-in). */
  ripple?: boolean;
}

/**
 * Canonical tappable surface for the app — the single source of truth for
 * press feedback so the touch experience is consistent everywhere.
 *
 * It wraps React Native's `Pressable` (the `themedComponents` re-export, which
 * the Unistyles babel plugin auto-binds to the C++ ShadowTree) and **appends**
 * the `pressed` style to the caller's style via the array pattern. The caller
 * keeps owning its `useVariants` styles, so this composes with variant-driven
 * components without freezing them.
 *
 * Do NOT wrap this (or its inner `Pressable`) with `withUnistyles`, and do NOT
 * rebuild it on `react-native-gesture-handler`'s `Pressable` — either drops
 * `StyleSheet.create` proxy values and freezes variants (unistyles#1109). For
 * gesture composition (Swipeable underlays, `GestureDetector` chains), keep
 * importing RNGH's `Pressable` directly at the call site.
 */
export const AppPressable: React.FC<AppPressableProps> = ({
  style,
  feedback = 'opacity',
  haptic = false,
  ripple = false,
  onPress,
  android_ripple,
  ...rest
}) => {
  const handlePress = (event: GestureResponderEvent) => {
    if (haptic) HapticService.selection();
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      onPress={onPress ? handlePress : undefined}
      android_ripple={android_ripple ?? (ripple ? RIPPLE.SUBTLE : undefined)}
      style={state => [
        typeof style === 'function' ? style(state) : style,
        feedback === 'opacity' && state.pressed && styles.pressed,
      ]}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
