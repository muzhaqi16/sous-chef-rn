import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from './Button';
import { IconName, Icon } from '#/utils/iconUtils';

export interface EmptyStateProps {
  /** Icon to display (can be IconName, emoji string, or React node) */
  icon?: IconName | string | React.ReactNode;

  /** Title text */
  title: string;

  /** Description/subtitle text */
  description?: string;

  /** Optional hint text (smaller, tertiary) */
  hint?: string;

  /** Primary action button */
  action?: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };

  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };

  /** Icon size */
  iconSize?: number;

  /** Icon color override */
  iconColor?: string;

  /** Icon library (default: uses Icon component default) */
  iconLibrary?: string;

  /** Container alignment */
  alignment?: 'flex-start' | 'center';

  /** Additional container styles */
  style?: StyleProp<ViewStyle>;

  /** Test ID for E2E testing */
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  hint,
  action,
  secondaryAction,
  iconSize = 64,
  iconColor,
  iconLibrary,
  alignment = 'center',
  style,
  testID,
}) => {
  const { theme } = useUnistyles();

  const renderIcon = () => {
    if (!icon) return null;

    // Check if icon is a React node (custom component)
    if (React.isValidElement(icon)) {
      return icon;
    }

    // Check if icon is an emoji (single character or emoji sequence)
    const isEmoji =
      typeof icon === 'string' && icon.length <= 4 && !/^[a-z-]+$/.test(icon);

    if (isEmoji) {
      return <Text style={[styles.emoji, { fontSize: iconSize }]}>{icon}</Text>;
    }

    return (
      <Icon
        name={icon as IconName}
        size={iconSize}
        color={iconColor || theme.colors.textSecondary}
        library={iconLibrary}
      />
    );
  };

  return (
    <View testID={testID} accessibilityRole="summary" style={[styles.container, { justifyContent: alignment }, style]}>
      {renderIcon()}
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
        {title}
      </Text>
      {description && (
        <Text
          style={[styles.description, { color: theme.colors.textSecondary }]}
        >
          {description}
        </Text>
      )}
      {hint && (
        <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
          {hint}
        </Text>
      )}
      {action && (
        <Button
          onPress={action.onPress}
          variant={action.variant || 'primary'}
          size="medium"
          style={styles.actionButton}
        >
          {action.label}
        </Button>
      )}
      {secondaryAction && (
        <Button
          onPress={secondaryAction.onPress}
          variant="outline"
          size="medium"
        >
          {secondaryAction.label}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },

  emoji: {
    marginBottom: theme.spacing.md,
  },

  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.fonts.weight.semibold,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },

  description: {
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },

  hint: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  actionButton: {
    marginBottom: theme.spacing.sm,
  },
}));

export default EmptyState;
