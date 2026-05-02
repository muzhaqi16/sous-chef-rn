import React from 'react';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export const ErrorMessage = ({ message }: { message: string }) => (
  <Text style={styles.errorText}>{message}</Text>
);

// Styles
const styles = StyleSheet.create(theme => ({
  errorText: {
    color: theme.colors.error,
    marginTop: 12,
    textAlign: 'center',
  },
}));
