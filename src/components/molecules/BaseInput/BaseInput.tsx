import type { ReactNode } from 'react';
import { IconButton } from '#components/atoms/IconButton';
import React, { useState } from 'react';
import { useTranslation } from '#i18n';
import type { TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';

/** The event passed to TextInput's onFocus/onBlur, derived from RN's own prop type. */
type TextInputFocusEvent = Parameters<
  NonNullable<TextInputProps['onFocus']>
>[0];
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import styles from '#components/molecules/BaseInput/BaseInput.styles';
import {
  ThemedActivityIndicator,
  ThemedTextInput,
  type ThemedTextInputRef,
} from '#components/atoms/themedComponents';
import { motion } from '#theme/motion';
import { kitTestIDs } from '#components/testIDs';
import { useFieldAccessibility } from '#hooks/ui/useFieldAccessibility';

export interface BaseInputProps extends TextInputProps {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  errorMessage?: string;
  /**
   * An error a form shows itself (`DynamicFormFields`): announced on the input,
   * never drawn here as well.
   */
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  showClearIcon?: boolean;
  onClear?: () => void;
  /**
   * Handed to the underlying TextInput, inside a sheet or out. Focus is only
   * reachable imperatively in React Native, so moving from one field to the
   * next needs this.
   */
  ref?: React.Ref<ThemedTextInputRef>;
  /** Shows a spinner where the clear button would sit, while a query is out. */
  isLoading?: boolean;
}

export const BaseInput: React.FC<BaseInputProps> = ({
  label,
  containerStyle,
  errorMessage,
  error,
  leftIcon,
  rightIcon,
  showClearIcon = false,
  onClear,
  style,
  onFocus,
  onBlur,
  value,
  multiline,
  ref,
  isLoading = false,
  accessibilityLabel,
  accessibilityHint,
  ...textInputProps
}) => {
  const { t } = useTranslation();
  const fieldAccessibility = useFieldAccessibility({
    label,
    error: errorMessage ?? error,
    accessibilityLabel,
    accessibilityHint,
  });
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorMessage);
  const showClear = showClearIcon && (value === undefined || value.length > 0);

  // Use variants for theme-aware styling
  const variantStyles = styles.useVariants({
    focused: isFocused,
    error: hasError,
    visible: hasError,
    rightIcon: rightIcon != null,
  });

  const handleFocus = (e: TextInputFocusEvent) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: TextInputFocusEvent) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[variantStyles.container, containerStyle]}>
      {label != null && <Text style={variantStyles.label}>{label}</Text>}
      <View style={variantStyles.inputContainer}>
        {leftIcon != null && (
          <View style={variantStyles.leftIconWrapper}>{leftIcon}</View>
        )}
        <ThemedTextInput
          ref={ref}
          style={[
            variantStyles.input,
            multiline && variantStyles.inputMultiline,
            rightIcon != null && variantStyles.inputWithRightIcon,
            style,
          ]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={value}
          multiline={multiline}
          {...fieldAccessibility}
          {...textInputProps}
        />
        {!!isLoading && (
          <ThemedActivityIndicator
            size="small"
            style={variantStyles.leftIconWrapper}
          />
        )}
        {!isLoading && !!showClear && (
          <IconButton
            name="close"
            size="xsPlus"
            tone="textSecondary"
            onPress={() => onClear?.()}
            accessibilityLabel={t('labels.clearInput')}
            accessibilityRole="button"
            style={variantStyles.leftIconWrapper}
          />
        )}
        {rightIcon != null && (
          <View style={variantStyles.rightIconWrapper}>{rightIcon}</View>
        )}
      </View>
      {!!hasError && (
        <Animated.View
          entering={FadeIn.duration(motion.timing.FAST)}
          exiting={FadeOut.duration(motion.timing.FAST)}
        >
          <Text
            role="error"
            tone="error"
            testID={
              textInputProps.testID
                ? kitTestIDs.inputError(textInputProps.testID)
                : undefined
            }
            style={variantStyles.errorText}
          >
            {errorMessage}
          </Text>
        </Animated.View>
      )}
    </View>
  );
};
