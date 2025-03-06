import React from 'react';
import {
  TextInput as RNTextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface Props extends TextInputProps {
  style?: StyleProp<ViewStyle>;
}

const stylesheet = createStyleSheet(theme => ({
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: theme.colors.typography,
  },
}));

const TextInput: React.FC<Props> = props => {
  const {styles} = useStyles(stylesheet);
  return <RNTextInput style={[styles.input, props.style]} {...props} />;
};

export default TextInput;
