import React from 'react';
import { TextInputProps, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FormFieldWrapper } from '../atoms/FormFieldWrapper';
import { ThemedTextInput } from '../atoms/themedComponents';

interface FormNumberInputProps
  extends Omit<TextInputProps, 'style' | 'keyboardType'> {
  label: string;
  error?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  keyboardType?: 'numeric' | 'decimal-pad' | 'number-pad';
}

export const FormNumberInput: React.FC<FormNumberInputProps> = ({
  label,
  error,
  required = false,
  containerStyle,
  inputStyle,
  keyboardType = 'numeric',
  onChangeText,
  ...textInputProps
}) => {
  styles.useVariants({ error: !!error });

  const handleChangeText = (text: string) => {
    // Allow only numbers and decimal point for decimal-pad
    if (keyboardType === 'decimal-pad') {
      const sanitized = text.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = sanitized.split('.');
      const result =
        parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
      onChangeText?.(result);
    } else {
      // For numeric/number-pad, only allow digits
      const sanitized = text.replace(/[^0-9]/g, '');
      onChangeText?.(sanitized);
    }
  };

  return (
    <FormFieldWrapper
      label={label}
      error={error}
      required={required}
      containerStyle={containerStyle}
    >
      <ThemedTextInput
        style={[styles.input, inputStyle]}
        keyboardType={keyboardType}
        onChangeText={handleChangeText}
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
    variants: {
      error: {
        true: { borderColor: theme.colors.error },
      },
    },
  },
}));
