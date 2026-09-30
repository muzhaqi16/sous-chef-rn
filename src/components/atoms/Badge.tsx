import React from 'react';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text, type TextTone } from '#components/atoms/Text';
import { Icon, type IconName, type IconTone } from '#/utils/iconUtils';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger';

const BADGE_TEXT_TONE: Record<BadgeVariant, TextTone> = {
  default: 'primary',
  primary: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

const BADGE_ICON_TONE: Record<BadgeVariant, IconTone> = {
  default: 'textPrimary',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/** One line of a stacked badge: an icon and a short value, in its own tone. */
export interface BadgeLine {
  icon: IconName;
  text: string;
  variant: BadgeVariant;
}

/** A row's badge as data. With `lines` it stacks, and `text` is what is read aloud. */
export interface BadgeContent {
  text: string;
  variant?: BadgeVariant;
  lines?: BadgeLine[];
}

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
      <Text role="footnoteStrong" tone={BADGE_TEXT_TONE[variant]}>
        {children}
      </Text>
    </View>
  );
};

/** Values that read as a set, stacked so they take one short column. */
export const BadgeStack: React.FC<{ label: string; lines: BadgeLine[] }> = ({
  label,
  lines,
}) => (
  <View
    accessible
    accessibilityRole="text"
    accessibilityLabel={label}
    style={styles.stack}
  >
    {lines.map(line => (
      <View key={`${line.icon}:${line.text}`} style={styles.stackLine}>
        <Icon name={line.icon} size="xs" tone={BADGE_ICON_TONE[line.variant]} />
        <Text role="footnoteStrong" tone={BADGE_TEXT_TONE[line.variant]}>
          {line.text}
        </Text>
      </View>
    ))}
  </View>
);

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
  stack: {
    gap: theme.spacing['2xs'],
  },
  stackLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
}));
