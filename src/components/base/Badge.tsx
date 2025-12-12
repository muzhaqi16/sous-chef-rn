import React from 'react';
import {View, Text, ViewStyle} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'small' | 'medium';
  style?: ViewStyle;
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
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.xs,
  },
  default: {
    backgroundColor: theme.colors.surface,
  },
  primary: {
    backgroundColor: theme.colors.primaryLight,
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
    paddingHorizontal: theme.spacing.xs + 2,
    paddingVertical: 2,
  },
  medium: {
    paddingHorizontal: theme.spacing['2.5'],
    paddingVertical: theme.spacing.xs + 2,
  },
  text: {
    fontSize: theme.typography.fontSize.xs,
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
