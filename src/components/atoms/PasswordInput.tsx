import React, {useState} from 'react';
import {Pressable} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Ionicons} from '@react-native-vector-icons/ionicons';
import {BaseInput, BaseInputProps} from './BaseInput/BaseInput';

export interface PasswordInputProps
  extends Omit<BaseInputProps, 'secureTextEntry'> {
  /** set to false to hide the "show password" toggle */
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
        <Pressable
          onPress={() => setVisible(v => !v)}
          style={({pressed}) => pressed && pressedStyles.pressed}>
          <Ionicons
            name={visible ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={visible ? '#333' : '#999'}
          />
        </Pressable>
      }
      {...props}
    />
  );
};

const pressedStyles = StyleSheet.create(theme => ({
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
