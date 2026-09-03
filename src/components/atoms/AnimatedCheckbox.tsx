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
// RNGH's Pressable, not the themed RN re-export: nested inside the row's RNGH
// Swipeable, only RNGH's native button captures the tap. An RN Pressable is in a
// separate gesture system, so the tap fires both toggle and row navigation.
import { Pressable } from 'react-native-gesture-handler';

type AnimatedCheckboxProps = {
  checked: boolean;
  itemId?: string; // Detects FlashList view recycling
  onPress?: () => void;
  size?: number;
  disabled?: boolean;
  testID?: string;
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
      testID={testID}
    >
      <Animated.View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: 6 },
          animatedStyle,
        ]}
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
    borderWidth: theme.borderWidth.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
