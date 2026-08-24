import React, { useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useAnimatedTheme } from 'react-native-unistyles/reanimated';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRecyclingState } from '@shopify/flash-list';
import { Icon } from '#utils/iconUtils';
import { HapticService } from '#services/haptic/HapticService';
import { standardEasing, TIMING } from '#/constants/animations';
// RNGH's Pressable (not the themed RN re-export). This checkbox is nested
// inside the row's RNGH Swipeable/Pressable; RNGH's native button captures the
// tap so it doesn't propagate to the row's onPress. An RN Pressable here lives
// in a separate gesture system and the tap fires both (toggle + row navigate).
import { Pressable } from 'react-native-gesture-handler';

type AnimatedCheckboxProps = {
  checked: boolean;
  itemId?: string; // Used to detect FlashList view recycling
  onPress?: () => void;
  size?: number;
  disabled?: boolean;
  testID?: string;
  /**
   * Show the toggled state immediately on press (default). Set false when the
   * press only *starts* a confirmed/deferred action (e.g. opens a sheet) so the
   * box stays on the real `checked` value until the change actually lands —
   * otherwise it gets stuck visually checked if the user cancels.
   */
  optimistic?: boolean;
};

export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  itemId,
  onPress,
  size = 24,
  disabled = false,
  testID,
  optimistic = true,
}) => {
  const animatedTheme = useAnimatedTheme();
  const isPressed = useSharedValue(false);
  styles.useVariants({ disabled });

  // Local state for pending visual state (shows immediately on press)
  // useRecyclingState auto-resets when itemId changes (FlashList view recycling)
  // onReset callback synchronously resets shared values during render (before paint)
  const [pendingChecked, setPendingChecked] = useRecyclingState<boolean | null>(
    null,
    [itemId],
    () => {
      isPressed.set(false);
    },
  );

  // Determine visual checked state: pending takes priority, otherwise actual
  const visuallyChecked = pendingChecked !== null ? pendingChecked : checked;

  // Clear pending state when actual checked prop syncs (render-time pattern)
  const [prevChecked, setPrevChecked] = useState(checked);
  if (checked !== prevChecked) {
    setPrevChecked(checked);
    if (pendingChecked !== null && checked === pendingChecked) {
      setPendingChecked(null);
    }
  }

  // Combined color + scale animation
  const animatedStyle = useAnimatedStyle(() => {
    const baseScale = visuallyChecked ? 1.05 : 1;
    const pressScale = isPressed.get() ? 0.9 : 1;
    return {
      backgroundColor: withTiming(
        visuallyChecked ? animatedTheme.get().colors.primary : 'transparent',
        { duration: TIMING.INSTANT, easing: standardEasing },
      ),
      borderColor: withTiming(
        visuallyChecked
          ? animatedTheme.get().colors.primary
          : animatedTheme.get().colors.border,
        { duration: TIMING.INSTANT, easing: standardEasing },
      ),
      transform: [
        {
          scale: withTiming(baseScale * pressScale, {
            duration: TIMING.INSTANT,
            easing: standardEasing,
          }),
        },
      ],
    };
  });

  const handlePressIn = () => {
    if (!disabled) {
      isPressed.set(true);
      // Short haptic feedback for checkbox toggle
      HapticService.light();
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      isPressed.set(false);
    }
  };

  // Handle press: show animation immediately, then call onPress
  // The caller is responsible for timing any state changes (e.g., via slide animation callback)
  const handlePress = () => {
    if (disabled) return;

    // Immediately show the opposite state — unless the press only starts a
    // deferred/confirmed action, in which case the box must stay on the real
    // `checked` value (it would otherwise stick checked if the user cancels).
    if (optimistic) {
      setPendingChecked(!checked);
    }

    // Fire onPress - caller handles timing of actual state change
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={styles.pressable}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: 6 },
          animatedStyle,
        ]}
      >
        {/* PERFORMANCE: Simple conditional render without layout animations */}
        {/* The container scale/color animation provides sufficient visual feedback */}
        {!!visuallyChecked && (
          <Icon name="checkmark" size={size * 0.66} color="white" />
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  pressable: {
    variants: {
      disabled: {
        true: { opacity: theme.opacity.disabled },
        false: { opacity: 1 },
      },
    },
  },
  container: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
