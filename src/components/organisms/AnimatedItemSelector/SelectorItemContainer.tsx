import React from 'react';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';

export type SelectorItemContainerState =
  | 'default'
  | 'selected'
  | 'delete-selected'
  | 'disabled';

interface SelectorItemContainerProps {
  state?: SelectorItemContainerState;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}

export const SelectorItemContainer: React.FC<SelectorItemContainerProps> = ({
  state = 'default',
  onPress,
  onLongPress,
  disabled,
  compact,
  children,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        compact && styles.compact,
        state === 'selected' && styles.selected,
        state === 'delete-selected' && styles.deleteSelected,
        state === 'disabled' && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  compact: {
    paddingVertical: theme.spacing.xs,
  },
  selected: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  deleteSelected: {
    backgroundColor: theme.colors.errorLight,
    borderColor: theme.colors.error,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
