import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from './Text';

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <View style={styles.errorContainer}>
      <Text tone="accent" align="center" style={styles.errorText}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    margin: theme.spacing.md,
  },
}));

export default ErrorMessage;
