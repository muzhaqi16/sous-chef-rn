import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  style?: object;
};

const stylesheet = createStyleSheet(theme => ({
  button: {
    backgroundColor: theme.colors.primary,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.buttonText || '#fff',
    fontSize: 16,
  },
}));

const Button: React.FC<ButtonProps> = ({title, onPress, style}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
};

export default Button;
