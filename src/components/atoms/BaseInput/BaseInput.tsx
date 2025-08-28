import React, {ReactNode} from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import styles from './BaseInput.styles';

export interface BaseInputProps extends TextInputProps {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  errorMessage?: string;
  rightIcon?: ReactNode;
}

export const BaseInput: React.FC<BaseInputProps> = ({
  label,
  containerStyle,
  errorMessage,
  rightIcon,
  style,
  ...textInputProps
}) => {
  return (
    <View style={containerStyle}>
      {label != null && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={styles.input.color} // Can access computed styles
          {...textInputProps}
        />
        {rightIcon != null && (
          <View style={styles.iconWrapper}>{rightIcon}</View>
        )}
      </View>
      {errorMessage != null && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
};
