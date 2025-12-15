import React from 'react';
import { TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import type { AddButtonProps } from './types';

export const AddButton: React.FC<AddButtonProps> = ({
  onPress,
  icon = 'add',
  iconLibrary = 'MaterialIcons',
}) => {
  const { theme } = useUnistyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.addButton}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Action button"
      accessibilityHint="Opens the action for the current tab"
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
    elevation: 8,
  },
}));
