import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '#utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Badge } from '../base/Badge';

interface ListItemProps {
  title: string;
  subtitle?: string | React.ReactNode;
  onPress?: () => void;
  leftIcon?: React.ComponentProps<typeof Icon>['name'];
  rightIcon?: React.ComponentProps<typeof Icon>['name'];
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  isPurchased?: boolean;
}

const ListItemComponent: React.FC<ListItemProps> = ({
  title,
  subtitle,
  onPress,
  leftIcon,
  rightIcon = 'chevron-right',
  badge,
  rightElement,
  leftElement,
  isPurchased = false,
}) => {
  const { theme } = useUnistyles();

  const content = (
    <>
      {leftElement}
      {leftIcon && (
        <View style={styles.leftIcon}>
          <Icon name={leftIcon} size={24} color={theme.colors.textSecondary} />
        </View>
      )}
      <View style={styles.content}>
        <Text
          style={[styles.title, isPurchased && styles.purchasedText]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle && (
          typeof subtitle === 'string' ? (
            <Text style={[styles.subtitle, isPurchased && styles.purchasedText]}>
              {subtitle}
            </Text>
          ) : (
            <View style={[styles.subtitleContainer, isPurchased && { opacity: 0.6 }]}>
              {subtitle}
            </View>
          )
        )}
      </View>
      {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
      {rightElement}
      {rightIcon && !rightElement && (
        <Icon name={rightIcon} size={24} color={theme.colors.textSecondary} />
      )}
    </>
  );

  if (onPress) {
    const subtitleText = typeof subtitle === 'string' ? subtitle : '';
    const accessibilityLabel = [title, subtitleText, badge?.text].filter(Boolean).join(', ');

    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.contentContainer}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Tap to view details"
          accessibilityState={{ disabled: isPurchased }}
        >
          {content}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>{content}</View>
    </View>
  );
};

export const ListItem = React.memo(ListItemComponent);

const styles = StyleSheet.create(theme => ({
  container: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    minHeight: 87,
  },
  leftIcon: {
    marginRight: theme.spacing['3'],
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  subtitleContainer: {
    marginTop: theme.spacing.xs,
  },
  purchasedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
    color: theme.colors.textSecondary,
  },
}));
