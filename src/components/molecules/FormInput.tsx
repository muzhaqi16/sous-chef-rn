import React from 'react';
import { TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FormFieldWrapper } from '../atoms/FormFieldWrapper';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';

interface FormInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Use BottomSheetTextInput for proper keyboard handling inside bottom sheets */
  useBottomSheetInput?: boolean;
  /** Optional element rendered inside the input on the right (e.g. an icon button). */
  trailing?: React.ReactNode;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  required = false,
  containerStyle,
  inputStyle,
  accessibilityLabel,
  accessibilityHint,
  useBottomSheetInput = false,
  trailing,
  ...textInputProps
}) => {
  const contextValue = useIsBottomSheetInput();
  const InputComponent =
    useBottomSheetInput || contextValue ? BottomSheetTextInput : TextInput;
  const { theme } = useUnistyles();

  // Generate accessibility label with required indicator if needed
  const inputLabel = accessibilityLabel || label;
  const fullLabel = required ? `${inputLabel}, required` : inputLabel;
  const fullHint = error
    ? `${accessibilityHint || ''}${
        accessibilityHint ? '. ' : ''
      }Error: ${error}`
    : accessibilityHint;

  return (
    <FormFieldWrapper
      label={label}
      error={error}
      required={required}
      containerStyle={containerStyle}
    >
      <View style={styles.inputContainer}>
        <InputComponent
          style={[
            styles.input,
            error && styles.inputError,
            !!trailing && styles.inputWithTrailing,
            inputStyle,
          ]}
          placeholderTextColor={theme.colors.textSecondary}
          accessible={true}
          accessibilityLabel={fullLabel}
          accessibilityHint={fullHint}
          accessibilityState={{
            disabled: textInputProps.editable === false,
          }}
          {...textInputProps}
        />
        {!!trailing && <View style={styles.trailing}>{trailing}</View>}
      </View>
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  },
  inputWithTrailing: {
    paddingRight: 52,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  trailing: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
