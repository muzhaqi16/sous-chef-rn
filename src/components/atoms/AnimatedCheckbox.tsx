import React, { useState, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
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
};

export const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = React.memo(({
  checked,
  onPress,
  onToggleComplete,
  size = 24,
  disabled = false,
  animationDuration = 400,
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
      transform: [
        {
          scale: withSpring(finalScale, {
            damping: 15,
            stiffness: 200,
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
    >
      <Animated.View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: 6 },
          animatedContainerStyle,
        ]}
      >
        {visuallyChecked && (
          <Animated.View
            entering={FadeIn.duration(200).easing(
              Easing.bezier(0.34, 1.56, 0.64, 1).factory(),
            )}
            exiting={FadeOut.duration(100).easing(
              Easing.bezier(0.25, 0.1, 0.25, 1).factory(),
            )}
          >
            <Icon name="check" size={size * 0.66} color="white" />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
