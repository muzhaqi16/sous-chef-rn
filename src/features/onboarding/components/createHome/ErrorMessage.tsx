import React from 'react';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';

export const ErrorMessage = ({ message }: { message: string }) => (
  <Text tone="error" align="center" style={styles.errorText}>
    {message}
  </Text>
);

// Styles
const styles = StyleSheet.create(theme => ({
  errorText: {
    marginTop: theme.spacing.base,
  },
}));
