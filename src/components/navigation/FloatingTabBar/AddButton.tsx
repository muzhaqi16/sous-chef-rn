import React from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import type { AddButtonProps } from './types';

export const AddButton: React.FC<AddButtonProps> = ({
  onPress,
  icon = 'add',
  iconLibrary = 'MaterialIcons',
  disabled = false,
}) => {
  const { theme } = useUnistyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.addButton, disabled && styles.addButtonDisabled]}
      activeOpacity={disabled ? 1 : 0.8}
      accessibilityRole="button"
      accessibilityLabel="Action button"
      accessibilityHint="Opens the action for the current tab"
      accessibilityState={{ disabled }}
    >
      <Icon
        name={icon}
        size={28}
        color={theme.colors.iconOnPrimary}
        library={iconLibrary}
      />
    </TouchableOpacity>
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
