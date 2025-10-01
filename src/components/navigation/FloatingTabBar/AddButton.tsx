import React from 'react';
import { TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import type { AddButtonProps } from './types';

export const AddButton: React.FC<AddButtonProps> = ({
  onPress,
  isActive = false,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.addButton}
      activeOpacity={0.8}
    >
      <Icon
        name="qr-code-scanner"
        size={24}
        color="#FFFFFF"
        library="MaterialIcons"
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 4, // Position outside the tab bar on the right
    top: -75, // Align with the tab bar height
    zIndex: 2,
    // Shadow for elevated effect
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
}));
