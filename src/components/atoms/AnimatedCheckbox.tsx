import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming } from 'react-native-reanimated';
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
  testID }) => {
  const { theme } = useUnistyles();
  const isPressed = useSharedValue(false);

  // Local state for pending visual state (shows immediately on press)
  const [pendingChecked, setPendingChecked] = useState<boolean | null>(null);

  // Render-time reset: track itemId to detect FlashList view recycling
  // This is required for FlashList compatibility per:
  // https://shopify.github.io/flash-list/docs/guides/reanimated
  const [prevItemId, setPrevItemId] = useState(itemId);
  if (itemId !== prevItemId) {
    setPrevItemId(itemId);
    if (itemId) {
      isPressed.set(false);
      setPendingChecked(null);
    }
  }

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

  // Color animation — only re-evaluates when visuallyChecked changes
  const animatedColorStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      visuallyChecked ? theme.colors.primary : 'transparent',
      { duration: 120, easing: standardEasing },
    ),
    borderColor: withTiming(
      visuallyChecked ? theme.colors.primary : theme.colors.border,
      { duration: 120, easing: standardEasing },
    ) }), [visuallyChecked, theme]);

  // Scale animation — separated so press changes don't re-evaluate color withTiming
  const animatedScaleStyle = useAnimatedStyle(() => {
    const baseScale = visuallyChecked ? 1.05 : 1;
    const pressScale = isPressed.value ? 0.9 : 1;
    return {
      transform: [
        { scale: withTiming(baseScale * pressScale, { duration: 100, easing: standardEasing }) },
      ] };
  }, [visuallyChecked]);

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

    // Immediately show opposite state visually
    const newState = !checked;
    setPendingChecked(newState);

    // Fire onPress - caller handles timing of actual state change
    onPress?.();
  };

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
          animatedColorStyle,
          animatedScaleStyle,
        ]}
      >
        {/* PERFORMANCE: Simple conditional render without layout animations */}
        {/* The container scale/color animation provides sufficient visual feedback */}
        {!!visuallyChecked && <Icon name="checkmark" size={size * 0.66} color="white" />}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create(_theme => ({
  container: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center' } }));
