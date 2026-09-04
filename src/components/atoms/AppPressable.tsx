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
 * Appends the `pressed` style to the caller's, so caller-owned variants survive.
 * Never wrap this (or its inner `Pressable`) with `withUnistyles` or rebuild it
 * on RNGH's — either freezes variants (unistyles#1109). Gesture composition
 * imports RNGH's `Pressable` at the call site instead.
 */
export const AppPressable: React.FC<AppPressableProps> = ({
  style,
  feedback = 'opacity',
  haptic = false,
  ripple = false,
  onPress,
  android_ripple,
  accessibilityRole,
  ...rest
}) => {
  const handlePress = (event: GestureResponderEvent) => {
    if (haptic) HapticService.selection();
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      // RN already sets `accessible`, so children collapse into one node and
      // their text is the name; an icon-only one needs a label, which
      // `check-a11y-names.mjs` requires.
      accessibilityRole={accessibilityRole ?? (onPress ? 'button' : undefined)}
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
