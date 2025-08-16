import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {stylesheet} from './styles';
import {useStyles} from 'react-native-unistyles';

import {ActionButtonProps} from './types';

export const ActionButton: React.FC<ActionButtonProps> = ({
  onPress,
  icon,
  backgroundColor,
  label,
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <TouchableOpacity
      style={[styles.actionButton, {backgroundColor}]}
      onPress={onPress}>
      <Icon name={icon} size={20} color="white" />
      {label && <Text style={styles.deleteText}>{label}</Text>}
    </TouchableOpacity>
  );
};
