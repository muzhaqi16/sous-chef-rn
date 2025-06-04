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

const TextInput: React.FC<Props> = props => {
  const {styles} = useStyles(stylesheet);
  return <RNTextInput style={[styles.input, props.style]} {...props} />;
};
const stylesheet = createStyleSheet(theme => ({
  input: {
    flex: 1,
    height: '100%', // This makes it fill the parent container vertically
    padding: 0,
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.colors.typography,
    fontSize: theme.font.size.md,
    textAlignVertical: 'center', // Helps center the text vertically on Android
  },
}));

export default TextInput;
