import React, { ReactNode, useState } from 'react';
import { useTranslation } from '#/i18n';
import { View, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { Text } from '#components/atoms/Text';

/** The event passed to TextInput's onFocus/onBlur, derived from RN's own prop type. */
type TextInputFocusEvent = Parameters<
  NonNullable<TextInputProps['onFocus']>
>[0];
import { AppPressable } from '#components/atoms/AppPressable';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import styles from '#components/molecules/BaseInput/BaseInput.styles';
import { Icon } from '#/utils/iconUtils';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';
import {
  ThemedActivityIndicator,
  ThemedBottomSheetTextInput,
  ThemedTextInput,
  type ThemedTextInputRef,
  type ThemedBottomSheetTextInputRef,
} from '#components/atoms/themedComponents';
import { motion } from '#/theme/foundations/motion';

export interface BaseInputProps extends TextInputProps {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  errorMessage?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  showClearIcon?: boolean;
  onClear?: () => void;
  /**
   * Handed to the underlying TextInput. Focus is only reachable imperatively
   * in React Native, so moving from one field to the next needs this.
   */
  ref?: React.Ref<ThemedTextInputRef>;
  /**
   * The same input, inside a sheet: gorhom's component has its own ref type,
   * so a caller that needs `focus()` in BOTH hosts passes both.
   */
  sheetRef?: React.Ref<ThemedBottomSheetTextInputRef>;
  /** Shows a spinner where the clear button would sit, while a query is out. */
  isLoading?: boolean;
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
  ref,
  sheetRef,
  isLoading = false,
  ...textInputProps
}) => {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorMessage);
  const showClear = showClearIcon && (value === undefined || value.length > 0);

  // Inside a sheet the input must be gorhom's, or the sheet is blind to the
  // keyboard. The context answers where this render is, so a caller does not.
  const isSheetInput = useIsBottomSheetInput();

  // Use variants for theme-aware styling
  styles.useVariants({
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
        {isSheetInput ? (
          <ThemedBottomSheetTextInput
            ref={sheetRef}
            style={[
              styles.input,
              multiline && styles.inputMultiline,
              rightIcon != null && styles.inputWithRightIcon,
              style,
            ]}
            onFocus={handleFocus}
            onBlur={handleBlur}
            value={value}
            multiline={multiline}
            {...textInputProps}
          />
        ) : (
          <ThemedTextInput
            ref={ref}
            style={[
              styles.input,
              multiline && styles.inputMultiline,
              rightIcon != null && styles.inputWithRightIcon,
              style,
            ]}
            onFocus={handleFocus}
            onBlur={handleBlur}
            value={value}
            multiline={multiline}
            {...textInputProps}
          />
        )}
        {!!isLoading && (
          <ThemedActivityIndicator
            size="small"
            style={styles.leftIconWrapper}
          />
        )}
        {!isLoading && !!showClear && (
          <AppPressable
            style={styles.leftIconWrapper}
            onPress={onClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('labels.clearInput')}
          >
            <Icon name="close" size={18} tone="textSecondary" />
          </AppPressable>
        )}
        {rightIcon != null && (
          <View style={styles.rightIconWrapper}>{rightIcon}</View>
        )}
      </View>
      {!!hasError && (
        <Animated.View
          entering={FadeIn.duration(motion.timing.FAST)}
          exiting={FadeOut.duration(motion.timing.FAST)}
        >
          <Text
            testID={
              textInputProps.testID
                ? `${textInputProps.testID}-error`
                : undefined
            }
            style={styles.errorText}
          >
            {errorMessage}
          </Text>
        </Animated.View>
      )}
    </View>
  );
};
