import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'small' | 'medium';
  style?: any;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'small',
  style,
}) => {
  return (
    <View style={[styles.badge, styles[variant], styles[size], style]}>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  default: {
    backgroundColor: theme.colors.surface,
  },
  primary: {
    backgroundColor: theme.colors.primary + '20',
  },
  success: {
    backgroundColor: theme.colors.successLight,
  },
  warning: {
    backgroundColor: theme.colors.warningLight,
  },
  danger: {
    backgroundColor: theme.colors.errorLight,
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  medium: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  defaultText: {
    color: theme.colors.textPrimary,
  },
  primaryText: {
    color: theme.colors.primary,
  },
  successText: {
    color: theme.colors.success,
  },
  warningText: {
    color: theme.colors.warning,
  },
  dangerText: {
    color: theme.colors.danger,
  },
}));
