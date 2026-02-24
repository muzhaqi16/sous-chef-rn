import React, { useCallback } from 'react';
import { Platform, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { HapticService } from '#services/haptic/HapticService';
import { SPRING } from '#/constants/animations';
import type { AddButtonProps } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const AddButton: React.FC<AddButtonProps> = ({
  onPress,
  icon = 'add',
  iconLibrary,
  disabled = false,
}) => {
  const { theme } = useUnistyles();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.set(withSpring(0.9, SPRING.PRESS));
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.set(withSpring(1, SPRING.PRESS));
  }, [scale]);

  const handlePress = useCallback(() => {
    HapticService.medium();
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      testID="tab-bar-add-button"
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.addButton, disabled && styles.addButtonDisabled, animatedStyle]}
      accessibilityRole="button"
      accessibilityLabel="Action button"
      accessibilityHint="Opens the action for the current tab"
      accessibilityState={{ disabled }}
      disabled={disabled}
    >
      <Icon
        name={icon}
        size={28}
        color={theme.colors.iconOnPrimary}
        library={iconLibrary}
      />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  addButton: {
    width: theme.sizes.fab.md,
    height: theme.sizes.button.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for elevated effect
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: theme.spacing.xs,
    },
    shadowOpacity: 0.3,
    shadowRadius: theme.radii.md,
    ...(Platform.OS === 'ios' && { elevation: 8 }),
  },
  addButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
}));
