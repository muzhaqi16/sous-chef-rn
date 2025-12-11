import React from 'react';
import {Text, TextInput, TextInputProps, ViewStyle} from 'react-native';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {FormFieldWrapper} from '../atoms/FormFieldWrapper';

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
  ...textInputProps
}) => {
  const InputComponent = useBottomSheetInput ? BottomSheetTextInput : TextInput;
  const {theme} = useUnistyles();

  // Generate accessibility label with required indicator if needed
  const inputLabel = accessibilityLabel || label;
  const fullLabel = required ? `${inputLabel}, required` : inputLabel;
  const fullHint = error
    ? `${accessibilityHint || ''}${accessibilityHint ? '. ' : ''}Error: ${error}`
    : accessibilityHint;

  return (
    <FormFieldWrapper
      label={label}
      error={error}
      required={required}
      containerStyle={containerStyle}
    >
      <InputComponent
        style={[styles.input, error && styles.inputError, inputStyle]}
        placeholderTextColor={theme.colors.textSecondary}
        accessible={true}
        accessibilityLabel={fullLabel}
        accessibilityHint={fullHint}
        accessibilityState={{
          disabled: textInputProps.editable === false,
        }}
        {...textInputProps}
      />
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
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
  inputError: {
    borderColor: theme.colors.error,
  },
}));
