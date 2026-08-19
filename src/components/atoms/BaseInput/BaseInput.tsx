import React, { ReactNode, useState } from 'react';
import { useTranslation } from '#/i18n';
import {
  View,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Text } from '#components/atoms/Text';

/** The event passed to TextInput's onFocus/onBlur, derived from RN's own prop type. */
type TextInputFocusEvent = Parameters<
  NonNullable<TextInputProps['onFocus']>
>[0];
import { AppPressable } from '#components/atoms/AppPressable';
import { withUnistyles } from 'react-native-unistyles';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import styles from './BaseInput.styles';
import { Icon } from '#/utils/iconUtils';

const ThemedTextInput = withUnistyles(TextInput, theme => ({
  placeholderTextColor: theme.colors.inputPlaceholder,
}));

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
  ref?: React.Ref<TextInput>;
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
  ...textInputProps
}) => {
  const { t } = useTranslation();
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
        {!!showClear && (
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
          entering={FadeIn.duration(TIMING.FAST)}
          exiting={FadeOut.duration(TIMING.FAST)}
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
