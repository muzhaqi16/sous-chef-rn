import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring } from 'react-native-reanimated';
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
  disabled = false }) => {
  const { theme } = useUnistyles();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.set(withSpring(0.9, SPRING.PRESS));
  };

  const handlePressOut = () => {
    scale.set(withSpring(1, SPRING.PRESS));
  };

  const handlePress = () => {
    HapticService.medium();
    onPress();
  };

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
    boxShadow: [{ offsetX: 0, offsetY: theme.spacing.xs, blurRadius: theme.radii.md, spreadDistance: 0, color: `${theme.colors.primary}4D` }] },
  addButtonDisabled: {
    opacity: 0.4,
    boxShadow: [] } }));
