import React from 'react';
import type { TextInputProps, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FormFieldWrapper } from '#components/atoms/FormFieldWrapper';
import { ThemedTextInput } from '#components/atoms/themedComponents';

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
    if (keyboardType === 'decimal-pad') {
      // Both separators: a comma keypad offers no period, so whitelisting one
      // of them deletes the only decimal key the person has.
      const sanitized = text.replace(/[^0-9.,]/g, '');
      const firstSeparator = sanitized.search(/[.,]/);
      const result =
        firstSeparator === -1
          ? sanitized
          : sanitized.slice(0, firstSeparator + 1) +
            sanitized.slice(firstSeparator + 1).replace(/[.,]/g, '');
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
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.base,
    ...theme.type.body,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    variants: {
      error: {
        true: { borderColor: theme.colors.error },
      },
    },
  },
}));
