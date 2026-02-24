import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from './Button';
import { IconName, Icon } from '#/utils/iconUtils';

export interface ErrorStateProps {
  /** Icon to display (can be IconName or emoji string) */
  icon?: IconName | string;

  /** Error title */
  title: string;

  /** Error message/description */
  message: string;

  /** Optional additional details */
  details?: string;

  /** Retry action */
  onRetry?: () => void;

  /** Retry button label */
  retryLabel?: string;

  /** Secondary action (e.g., "Go Back", "Contact Support") */
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };

  /** Icon size */
  iconSize?: number;

  /** Error severity (affects colors) */
  severity?: 'error' | 'warning' | 'info';

  /** Container alignment */
  alignment?: 'flex-start' | 'center';

  /** Additional container styles */
  style?: StyleProp<ViewStyle>;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  icon = '⚠️',
  title,
  message,
  details,
  onRetry,
  retryLabel = 'Try Again',
  secondaryAction,
  iconSize = 48,
  severity = 'error',
  alignment = 'flex-start',
  style,
}) => {
  const { theme } = useUnistyles();

  const severityColors = {
    error: theme.colors.error,
    warning: theme.colors.warning,
    info: theme.colors.info,
  };

  const renderIcon = () => {
    // Check if icon is an emoji (single character or emoji sequence)
    const isEmoji = typeof icon === 'string' && icon.length <= 4 && !/^[a-z-]+$/.test(icon);

    if (isEmoji) {
      return <Text style={[styles.emoji, { fontSize: iconSize }]}>{icon}</Text>;
    }

    return (
      <Icon
        name={icon as IconName}
        size={iconSize}
        color={severityColors[severity]}
      />
    );
  };

  return (
    <View style={[styles.container, { justifyContent: alignment }, style]}>
      {renderIcon()}
      <Text style={[styles.title, { color: severityColors[severity] }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
        {message}
      </Text>
      {!!details && (
        <Text style={[styles.details, { color: theme.colors.textTertiary }]}>
          {details}
        </Text>
      )}
      {!!onRetry && (
        <Button
          onPress={onRetry}
          variant="primary"
          size="medium"
          style={styles.actionButton}
        >
          {retryLabel}
        </Button>
      )}
      {!!secondaryAction && (
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },

  emoji: {
    marginBottom: theme.spacing.xs,
  },

  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },

  message: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.lineHeight.normal,
  },

  details: {
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    fontFamily: 'monospace',
  },

  actionButton: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
}));

export default ErrorState;
