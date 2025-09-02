import React, {ReactNode, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {useUnistyles} from 'react-native-unistyles';
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
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const {theme} = useUnistyles();
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorMessage);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label != null && (
        <Text style={styles.label}>{label}</Text>
      )}
      <View style={styles.inputContainer(isFocused, hasError)}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.inputPlaceholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...textInputProps}
        />
        {rightIcon != null && (
          <View style={styles.iconWrapper}>{rightIcon}</View>
        )}
      </View>
      {hasError && (
        <Text style={styles.errorText(hasError)}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
};
