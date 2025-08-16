import React from 'react';
import {Text, TouchableOpacity} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

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
  const {styles} = useStyles(stylesheet);

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

const stylesheet = createStyleSheet(theme => ({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border || '#E0E0E0',
    alignItems: 'center',
  },
  default: {
    backgroundColor: theme.colors.surface,
  },
  danger: {
    backgroundColor: theme.colors.surface,
  },
  primary: {
    backgroundColor: theme.colors.primary || '#62B1F6',
    borderBottomWidth: 0,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
  defaultText: {
    color: theme.colors.textPrimary,
  },
  dangerText: {
    color: theme.colors.error || '#FF3B30',
  },
  primaryText: {
    color: '#FFFFFF',
  },
}));
