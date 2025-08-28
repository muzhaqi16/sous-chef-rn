import React, {useState} from 'react';
import {TouchableOpacity} from 'react-native';
import Feather from '@react-native-vector-icons/feather';
import {BaseInput, BaseInputProps} from './BaseInput/BaseInput';

export interface PasswordInputProps
  extends Omit<BaseInputProps, 'secureTextEntry'> {
  /** set to false to hide the “show password” toggle */
  showToggle?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  showToggle = true,
  ...props
}) => {
  const [visible, setVisible] = useState(false);
  // if showToggle is false, always hide the password
  if (!showToggle) {
    return (
      <BaseInput
        secureTextEntry={true}
        autoCapitalize="none"
        placeholder="••••••••"
        {...props}
      />
    );
  }
  return (
    <BaseInput
      secureTextEntry={!visible}
      autoCorrect={false}
      autoCapitalize="none"
      placeholder="••••••••"
      rightIcon={
        <TouchableOpacity onPress={() => setVisible(v => !v)}>
          <Feather
            name={visible ? 'eye' : 'eye-off'}
            size={20}
            color={visible ? '#333' : '#999'}
          />
        </TouchableOpacity>
      }
      {...props}
    />
  );
};
