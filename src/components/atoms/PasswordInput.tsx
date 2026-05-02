import React, { useState } from 'react';

import { StyleSheet } from 'react-native-unistyles';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { BaseInput, BaseInputProps } from './BaseInput/BaseInput';
import { Pressable } from 'react-native-gesture-handler';

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
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [
            pressedStyles.toggle,
            pressed && pressedStyles.pressed,
          ]}
        >
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
  toggle: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
