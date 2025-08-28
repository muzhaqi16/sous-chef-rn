import React from 'react';
import {View, TouchableOpacity, Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface ActionButtonsProps {
  primaryAction: {
    label: string;
    onPress: () => void;
  };
  secondaryAction: {
    label: string;
    onPress: () => void;
  };
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  primaryAction,
  secondaryAction,
}) => {
  return (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={primaryAction.onPress}>
        <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={secondaryAction.onPress}>
        <Text style={styles.secondaryButtonText}>{secondaryAction.label}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#62B1F6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#62B1F6',
  },
  secondaryButtonText: {
    color: '#62B1F6',
    fontSize: 16,
    fontWeight: '500',
  },
}));
