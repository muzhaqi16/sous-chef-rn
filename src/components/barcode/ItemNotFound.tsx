import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import Icon from '@react-native-vector-icons/material-icons';

interface ItemNotFoundProps {
  barcode: string;
}

export const ItemNotFound: React.FC<ItemNotFoundProps> = ({barcode}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.notFoundIcon}>
        <Icon name="qr-code-scanner" size={48} color="#6c757d" />
      </Text>
      <Text style={styles.notFoundText}>Item Not Found</Text>
      <Text style={styles.notFoundMessage}>
        No item found with barcode: {barcode}
      </Text>
      <Text style={styles.addItemHint}>
        You can add this item to the database using the form below.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
  },
  notFoundIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  notFoundText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  notFoundMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  addItemHint: {
    fontSize: 14,
    color: '#62B1F6',
    textAlign: 'center',
    fontStyle: 'italic',
  },
}));
