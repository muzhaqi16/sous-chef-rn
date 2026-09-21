import React from 'react';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text, type TextTone } from '#components/atoms/Text';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';

const BADGE_TEXT_TONE: Record<BadgeVariant, TextTone> = {
  default: 'primary',
  primary: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
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
      <Text role="bodyStrong" tone={BADGE_TEXT_TONE[variant]}>
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
    borderCurve: 'continuous',
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
          paddingHorizontal: theme.spacing.xsPlus,
          paddingVertical: theme.spacing['2xs'],
        },
        medium: {
          paddingHorizontal: theme.spacing.smPlus,
          paddingVertical: theme.spacing.xsPlus,
        },
      },
    },
  },
}));
