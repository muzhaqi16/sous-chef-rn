import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SousChefLoader } from '#/components/base/SousChefLoader';

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
      <SousChefLoader size="small" showBrand={false} message={message} />
      {barcode ? <Text style={styles.barcodeText}>Barcode: {barcode}</Text> : null}
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
  barcodeText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
}));
