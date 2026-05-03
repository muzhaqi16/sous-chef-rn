import React from 'react';
import { View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

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
  styles.useVariants({
    variant: variant === 'default' ? undefined : variant,
    size,
  });

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      style={[styles.badge, style]}
    >
      <Text maxFontSizeMultiplier={1.5} style={styles.text}>
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    variants: {
      variant: {
        default: { backgroundColor: theme.colors.surface },
        primary: { backgroundColor: theme.colors.primaryLight },
        success: { backgroundColor: theme.colors.successLight },
        warning: { backgroundColor: theme.colors.warningLight },
        danger: { backgroundColor: theme.colors.errorLight },
      },
      size: {
        small: {
          paddingHorizontal: theme.spacing.xs + 2,
          paddingVertical: 2,
        },
        medium: {
          paddingHorizontal: theme.spacing['2.5'],
          paddingVertical: theme.spacing.xs + 2,
        },
      },
    },
  },
  text: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    variants: {
      variant: {
        default: { color: theme.colors.textPrimary },
        primary: { color: theme.colors.primary },
        success: { color: theme.colors.success },
        warning: { color: theme.colors.warning },
        danger: { color: theme.colors.danger },
      },
    },
  },
}));
