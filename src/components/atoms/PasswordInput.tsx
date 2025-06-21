// components/atoms/PasswordInput.tsx
import React, {useState} from 'react';
import {TouchableOpacity} from 'react-native';
import Feather from '@react-native-vector-icons/feather';
import {BaseInput, BaseInputProps} from './BaseInput';

export const PasswordInput: React.FC<
  Omit<BaseInputProps, 'secureTextEntry'>
> = props => {
  const [visible, setVisible] = useState(false);
  return (
    <BaseInput
      secureTextEntry={!visible}
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
