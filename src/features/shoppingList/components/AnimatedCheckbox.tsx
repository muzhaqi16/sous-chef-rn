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

// RNGH's Pressable, not the themed RN re-export: nested inside the row's RNGH
// Swipeable, only RNGH's native button captures the tap. An RN Pressable is in a
// separate gesture system, so the tap fires both toggle and row navigation.
import { Pressable } from 'react-native-gesture-handler';
import { motion } from '#/theme/foundations/motion';

type AnimatedCheckboxProps = {
  checked: boolean;
  itemId?: string; // Detects FlashList view recycling
  onPress?: () => void;
  size?: number;
  disabled?: boolean;
  testID?: string;
  /** What the box is about — the item's name. */
  accessibilityLabel?: string;
  /**
   * Show the toggled state immediately on press (default). Set false when the
   * press only starts a deferred/confirmed action (e.g. opens a sheet), or the
   * box sticks visually checked when the user cancels.
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
  accessibilityLabel,
  optimistic = true,
}) => {
  const animatedTheme = useAnimatedTheme();
  const isPressed = useSharedValue(false);
  styles.useVariants({ disabled });

  // useRecyclingState auto-resets on itemId change; onReset clears the shared
  // value synchronously during render, before paint.
  const [pendingChecked, setPendingChecked] = useRecyclingState<boolean | null>(
    null,
    [itemId],
    () => {
      isPressed.set(false);
    },
  );

  const visuallyChecked = pendingChecked !== null ? pendingChecked : checked;

  const [prevChecked, setPrevChecked] = useState(checked);
  if (checked !== prevChecked) {
    setPrevChecked(checked);
    if (pendingChecked !== null && checked === pendingChecked) {
      setPendingChecked(null);
    }
  }

  const animatedStyle = useAnimatedStyle(() => {
    const baseScale = visuallyChecked ? 1.05 : 1;
    const pressScale = isPressed.get() ? 0.9 : 1;
    return {
      backgroundColor: withTiming(
        visuallyChecked ? animatedTheme.get().colors.primary : 'transparent',
        { duration: motion.timing.INSTANT, easing: motion.easing.standard },
      ),
      borderColor: withTiming(
        visuallyChecked
          ? animatedTheme.get().colors.primary
          : animatedTheme.get().colors.border,
        { duration: motion.timing.INSTANT, easing: motion.easing.standard },
      ),
      transform: [
        {
          scale: withTiming(baseScale * pressScale, {
            duration: motion.timing.INSTANT,
            easing: motion.easing.standard,
          }),
        },
      ],
    };
  });

  const handlePressIn = () => {
    if (!disabled) {
      isPressed.set(true);
      HapticService.light();
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      isPressed.set(false);
    }
  };

  // The caller owns the timing of the real state change.
  const handlePress = () => {
    if (disabled) return;

    if (optimistic) {
      setPendingChecked(!checked);
    }

    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={styles.pressable}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: !!visuallyChecked, disabled }}
      testID={testID}
    >
      <Animated.View
        style={[styles.container, { width: size, height: size }, animatedStyle]}
      >
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
    borderRadius: theme.radii.smPlus,
    borderWidth: theme.borderWidth.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
