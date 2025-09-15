import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface HeaderProps {
  title: string;
  onBackPress: () => void;
  onScanPress: () => void;
  showScanButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBackPress,
  onScanPress,
  showScanButton = true,
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBackPress}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {showScanButton && (
        <TouchableOpacity onPress={onScanPress}>
          <Text style={styles.scanButton}>Scan</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  // Common styles that would be shared across components
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    color: '#62B1F6',
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  scanButton: {
    color: '#62B1F6',
    fontSize: 16,
    fontWeight: '500',
  },
}));
