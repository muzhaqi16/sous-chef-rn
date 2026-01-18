import React, { useState, useCallback, useEffect } from 'react';
import { Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Icon } from '#utils';
import { HapticService } from '#services/haptic';

type AnimatedCheckboxProps = {
  checked: boolean;
  onPress?: () => void;
  onToggleComplete?: () => void; // Called after animation finishes
  size?: number;
  disabled?: boolean;
  animationDuration?: number; // How long to wait before calling onToggleComplete
  testID?: string;
};

export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = React.memo(({
  checked,
  onPress,
  onToggleComplete,
  size = 24,
  disabled = false,
  animationDuration = 400,
  testID,
}) => {
  const { theme } = useUnistyles();
  const isPressed = useSharedValue(false);

  // Local state for pending visual state (shows immediately on press)
  const [pendingChecked, setPendingChecked] = useState<boolean | null>(null);

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
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
      ),
      borderColor: withTiming(
        visuallyChecked ? theme.colors.primary : theme.colors.border,
        {
          duration: 120,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
      ),
      // PERFORMANCE: Use timing instead of spring for cheaper animation
      transform: [
        {
          scale: withTiming(finalScale, {
            duration: 100,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
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

  // Handle press: show animation immediately, then call completion after delay
  const handlePress = useCallback(() => {
    if (disabled) return;

    // Immediately show opposite state visually
    const newState = !checked;
    setPendingChecked(newState);

    // Fire immediate onPress for any non-animation work (haptic already fired in handlePressIn)
    onPress?.();

    // After animation duration, call completion callback
    if (onToggleComplete) {
      setTimeout(() => {
        onToggleComplete();
      }, animationDuration);
    }
  }, [checked, disabled, onPress, onToggleComplete, animationDuration]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
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
          <Icon name="check" size={size * 0.66} color="white" />
        )}
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create(_theme => ({
  container: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
