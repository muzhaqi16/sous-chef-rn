import React, { useState, useCallback, useEffect } from 'react';
import { Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import { HapticService } from '#services/haptic/HapticService';
import { standardEasing } from '#/constants/animations';

type AnimatedCheckboxProps = {
  checked: boolean;
  itemId?: string; // Used to detect FlashList view recycling
  onPress?: () => void;
  size?: number;
  disabled?: boolean;
  animationDuration?: number; // Duration for checkbox visual animation
  testID?: string;
};

export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  itemId,
  onPress,
  size = 24,
  disabled = false,
  animationDuration: _animationDuration = 400,
  testID,
}) => {
  const { theme } = useUnistyles();
  const isPressed = useSharedValue(false);

  // Local state for pending visual state (shows immediately on press)
  const [pendingChecked, setPendingChecked] = useState<boolean | null>(null);

  // Reset animation state when view is recycled (itemId changes)
  // This is required for FlashList compatibility per:
  // https://shopify.github.io/flash-list/docs/guides/reanimated
  useEffect(() => {
    if (itemId) {
      isPressed.value = false;
      setPendingChecked(null);
    }
  }, [itemId, isPressed]);

  // Determine visual checked state: pending takes priority, otherwise actual
  const visuallyChecked = pendingChecked !== null ? pendingChecked : checked;

  // Clear pending state when actual checked prop syncs
  useEffect(() => {
    if (pendingChecked !== null && checked === pendingChecked) {
      setPendingChecked(null);
    }
  }, [checked, pendingChecked]);

  // Animated style for the checkbox container
  const animatedContainerStyle = useAnimatedStyle(() => {
    // Combine checked scale (1.05) with press scale (0.9)
    const baseScale = visuallyChecked ? 1.05 : 1;
    const pressScale = isPressed.value ? 0.9 : 1;
    const finalScale = baseScale * pressScale;

    return {
      backgroundColor: withTiming(
        visuallyChecked ? theme.colors.primary : 'transparent',
        {
          duration: 120,
          easing: standardEasing,
        },
      ),
      borderColor: withTiming(
        visuallyChecked ? theme.colors.primary : theme.colors.border,
        {
          duration: 120,
          easing: standardEasing,
        },
      ),
      // PERFORMANCE: Use timing instead of spring for cheaper animation
      transform: [
        {
          scale: withTiming(finalScale, {
            duration: 100,
            easing: standardEasing,
          }),
        },
      ],
    };
  }, [visuallyChecked, theme]);

  const handlePressIn = useCallback(() => {
    if (!disabled) {
      isPressed.value = true;
      // Short haptic feedback for checkbox toggle
      HapticService.light();
    }
  }, [disabled, isPressed]);

  const handlePressOut = useCallback(() => {
    if (!disabled) {
      isPressed.value = false;
    }
  }, [disabled, isPressed]);

  // Handle press: show animation immediately, then call onPress
  // The caller is responsible for timing any state changes (e.g., via slide animation callback)
  const handlePress = useCallback(() => {
    if (disabled) return;

    // Immediately show opposite state visually
    const newState = !checked;
    setPendingChecked(newState);

    // Fire onPress - caller handles timing of actual state change
    onPress?.();
  }, [checked, disabled, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={{ opacity: disabled ? theme.opacity.disabled : 1 }}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: 6 },
          animatedContainerStyle,
        ]}
      >
        {/* PERFORMANCE: Simple conditional render without layout animations */}
        {/* The container scale/color animation provides sufficient visual feedback */}
        {visuallyChecked && (
          <Icon name="checkmark" size={size * 0.66} color="white" />
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create(_theme => ({
  container: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
