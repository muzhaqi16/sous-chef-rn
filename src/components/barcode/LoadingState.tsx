import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';

const UniActivityIndicator = withUnistyles(ActivityIndicator);

interface LoadingStateProps {
  message: string;
  barcode?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  barcode,
}) => {
  return (
    <View style={styles.container}>
      <UniActivityIndicator
        size="large"
        uniProps={theme => ({ color: theme.colors.primary })}
      />
      <Text style={styles.loadingText}>{message}</Text>
      {barcode && <Text style={styles.barcodeText}>Barcode: {barcode}</Text>}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  loadingText: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  barcodeText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
}));
