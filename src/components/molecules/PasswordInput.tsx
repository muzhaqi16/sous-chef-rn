import React from 'react';
import {TextInput, TextInputProps, View, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

interface InputProps extends TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}

const PasswordInput: React.FC<InputProps> = props => {
  const {styles} = useStyles(stylesheet);
  const {label, value, onChangeText} = props;
  return (
    <View style={styles.input}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={email => onChangeText(email)}
        onBlur={props.onBlur}
        placeholder={props.placeholder || '********'}
        placeholderTextColor="#6b7280"
        style={styles.inputControl}
        secureTextEntry={true}
        value={value}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  /** Input */
  input: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 6,
  },
  inputControl: {
    height: 44,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: '500',
    borderColor: theme.colors.typography,
    color: theme.colors.typography,
  },
}));

export default PasswordInput;
