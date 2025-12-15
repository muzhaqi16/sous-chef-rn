import React, { ReactNode, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
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
  ...textInputProps
}) => {
  const { theme } = useUnistyles();
  // Subscribe to theme from store to trigger re-renders when theme changes
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorMessage);
  const showClear = showClearIcon && Boolean(value && value.length > 0);

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
      <View style={styles.inputContainer(isFocused, hasError)}>
        {leftIcon != null && <View style={styles.iconWrapper}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.inputPlaceholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={value}
          {...textInputProps}
        />
        {showClear && (
          <TouchableOpacity
            style={styles.iconWrapper}
            onPress={onClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
        {rightIcon != null && (
          <View
            style={[styles.iconWrapper, { paddingRight: theme.spacing.sm }]}
          >
            {rightIcon}
          </View>
        )}
      </View>
      {hasError && (
        <Text style={styles.errorText(hasError)}>{errorMessage}</Text>
      )}
    </View>
  );
};
