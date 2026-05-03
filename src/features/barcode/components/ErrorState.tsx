import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '#components/base/Button';
import { Text } from '#components/atoms/Text';

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
      <Text size="xl" weight="semibold" tone="error" align="center">
        {title}
      </Text>
      <Text
        size="sm"
        tone="secondary"
        align="center"
        style={styles.errorMessage}
      >
        {message}
      </Text>
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
  errorMessage: {
    marginBottom: theme.spacing.lg,
  },
}));
