import React from 'react';
import {TextInput, TextInputProps} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface InputProps extends TextInputProps {}

const Input: React.FC<InputProps> = props => {
  const {styles} = useStyles(stylesheet);
  return <TextInput autoCapitalize="none" style={styles.input} {...props} />;
};

const stylesheet = createStyleSheet(theme => ({
  input: {
    width: '100%',
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.typography,
    borderRadius: 5,
    color: theme.colors.typography,
  },
}));

export default Input;
