import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface SettingButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
}

export const SettingButton: React.FC<SettingButtonProps> = ({
  title,
  onPress,
  variant = 'default',
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, styles[variant], disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  default: {
    backgroundColor: theme.colors.surface,
  },
  danger: {
    backgroundColor: theme.colors.surface,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    borderBottomWidth: 0,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
  },
  defaultText: {
    color: theme.colors.textPrimary,
  },
  dangerText: {
    color: theme.colors.error,
  },
  primaryText: {
    color: theme.colors.white,
  },
}));
