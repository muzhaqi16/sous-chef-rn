import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {styles} from './styles';
import {useUnistyles} from 'react-native-unistyles';
import {ActionButtonProps} from './types';

export const ActionButton: React.FC<ActionButtonProps> = ({
  onPress,
  icon,
  backgroundColor,
  label,
}) => {
  const {theme} = useUnistyles();

  return (
    <TouchableOpacity
      style={[styles.actionButton, {backgroundColor: backgroundColor}]}
      onPress={onPress}>
      <Icon name={icon} size={20} color={theme.colors.white} />
      {label && <Text style={styles.deleteText}>{label}</Text>}
    </TouchableOpacity>
  );
};
