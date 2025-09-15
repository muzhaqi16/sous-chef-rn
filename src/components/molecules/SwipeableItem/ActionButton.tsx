import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import {Icon} from '#utils/iconUtils';
import {styles} from './styles';
import {useUnistyles} from 'react-native-unistyles';
import {ActionButtonProps} from './types';

export const ActionButton: React.FC<ActionButtonProps> = ({
  onPress,
  icon,
  backgroundColor,
  label,
  circular = false,
}) => {
  const {theme} = useUnistyles();

  const buttonStyle = circular
    ? styles.circularActionButton
    : styles.actionButton;
  const iconColor = circular ? theme.colors.white : theme.colors.white;
  const iconSize = circular ? 24 : 20;

  return (
    <TouchableOpacity
      style={[buttonStyle, circular ? {} : {backgroundColor: backgroundColor}]}
      onPress={onPress}>
      <Icon name={icon} size={iconSize} color={iconColor} />
      {label && <Text style={styles.deleteText}>{label}</Text>}
    </TouchableOpacity>
  );
};
