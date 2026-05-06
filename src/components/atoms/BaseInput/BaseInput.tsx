import React, { ReactNode, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useUnistyles } from 'react-native-unistyles';
import styles from './BaseInput.styles';
import { Icon } from '#/utils/iconUtils';

export interface BaseInputProps extends TextInputProps {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  errorMessage?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  showClearIcon?: boolean;
  onClear?: () => void;
}

export const BaseInput: React.FC<BaseInputProps> = ({
  label,
  containerStyle,
  errorMessage,
  leftIcon,
  rightIcon,
  showClearIcon = false,
  onClear,
  style,
  onFocus,
  onBlur,
  value,
  multiline,
  ...textInputProps
}) => {
  const { theme } = useUnistyles();
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorMessage);
  const showClear = showClearIcon && Boolean(value && value.length > 0);

  // Use variants for theme-aware styling
  styles.useVariants({
    focused: isFocused,
    error: hasError,
    visible: hasError,
    rightIcon: rightIcon != null,
  });

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
      {label != null && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          multiline && styles.inputContainerMultiline,
        ]}
      >
        {leftIcon != null && (
          <View style={styles.leftIconWrapper}>{leftIcon}</View>
        )}
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            rightIcon != null && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={theme.colors.inputPlaceholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={value}
          multiline={multiline}
          {...textInputProps}
        />
        {!!showClear && (
          <Pressable
            style={({ pressed }) => [
              styles.leftIconWrapper,
              pressed && styles.pressed,
            ]}
            onPress={onClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Clear input"
          >
            <Icon name="close" size={18} tone="textSecondary" />
          </Pressable>
        )}
        {rightIcon != null && (
          <View style={styles.rightIconWrapper}>{rightIcon}</View>
        )}
      </View>
      {!!hasError && (
        <Text
          testID={
            textInputProps.testID ? `${textInputProps.testID}-error` : undefined
          }
          style={styles.errorText}
        >
          {errorMessage}
        </Text>
      )}
    </View>
  );
};
