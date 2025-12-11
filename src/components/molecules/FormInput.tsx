import React from 'react';
import { TextInput, TextInputProps, ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FormFieldWrapper } from '../atoms/FormFieldWrapper';

interface FormInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  required = false,
  containerStyle,
  inputStyle,
  accessibilityLabel,
  accessibilityHint,
  ...textInputProps
}) => {
  const { theme } = useUnistyles();

  // Generate accessibility hints
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
      accessibilityLabel={inputLabel}
    >
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
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
