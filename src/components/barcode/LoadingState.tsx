import React from 'react';
import {View, Text, ActivityIndicator} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

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
      <ActivityIndicator size="large" color="#62B1F6" />
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
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#495057',
    marginTop: 16,
    marginBottom: 8,
  },
  barcodeText: {
    fontSize: 14,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
}));
