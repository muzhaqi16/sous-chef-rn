import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#components/base/Button';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  icon?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  onRetry,
  icon = '⚠️',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.errorIcon}>{icon}</Text>
      <Text style={styles.errorText}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {!!onRetry && (
        <Button onPress={onRetry} variant="primary" size="medium">
          Try Again
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  errorIcon: {
    fontSize: theme.sizes.avatar.lg,
  },
  errorText: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.error,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
}));
