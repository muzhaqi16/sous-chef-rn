import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { PressableScale } from '#components/atoms/PressableScale';
import type { AddButtonProps } from './types';

export const AddButton: React.FC<AddButtonProps> = ({
  onPress,
  icon = 'add',
  iconLibrary,
  disabled = false,
}) => {
  styles.useVariants({ disabled });

  return (
    <PressableScale
      testID="tab-bar-add-button"
      onPress={onPress}
      activeScale={0.9}
      haptic="medium"
      style={styles.addButton}
      accessibilityRole="button"
      accessibilityLabel="Action button"
      accessibilityHint="Opens the action for the current tab"
      accessibilityState={{ disabled }}
      disabled={disabled}
    >
      <Icon name={icon} size={28} tone="white" library={iconLibrary} />
    </PressableScale>
  );
};

const styles = StyleSheet.create(theme => ({
  addButton: {
    width: theme.sizes.fab.md,
    height: theme.sizes.button.md,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    // Primary CTA — follows the user's selected App Color so the + button
    // matches the active tab icon highlight and other primary-tinted surfaces.
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for elevated effect
    boxShadow: [
      {
        offsetX: 0,
        offsetY: theme.spacing.xs,
        blurRadius: theme.radii.md,
        spreadDistance: 0,
        color: `${theme.colors.primary}4D`,
      },
    ],
    variants: {
      disabled: {
        true: {
          opacity: 0.4,
          boxShadow: [],
        },
      },
    },
  },
}));
