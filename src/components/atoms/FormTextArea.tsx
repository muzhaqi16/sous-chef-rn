import React from 'react';
import { TextInputProps, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FormFieldWrapper } from '#components/atoms/FormFieldWrapper';
import {
  ThemedBottomSheetTextInput,
  ThemedTextInput,
} from '#components/atoms/themedComponents';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';

interface FormTextAreaProps
  extends Omit<TextInputProps, 'style' | 'multiline'> {
  label: string;
  error?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  numberOfLines?: number;
  /** Use BottomSheetTextInput for proper keyboard handling inside bottom sheets */
  useBottomSheetInput?: boolean;
}

export const FormTextArea: React.FC<FormTextAreaProps> = ({
  label,
  error,
  required = false,
  containerStyle,
  inputStyle,
  numberOfLines = 4,
  useBottomSheetInput = false,
  ...textInputProps
}) => {
  const contextValue = useIsBottomSheetInput();
  const InputComponent =
    useBottomSheetInput || contextValue
      ? ThemedBottomSheetTextInput
      : ThemedTextInput;

  styles.useVariants({ error: !!error });

  // Calculate height based on number of lines
  const inputHeight = numberOfLines * 24 + 24;

  return (
    <FormFieldWrapper
      label={label}
      error={error}
      required={required}
      containerStyle={containerStyle}
    >
      <InputComponent
        style={[styles.input, { height: inputHeight }, inputStyle]}
        multiline
        numberOfLines={numberOfLines}
        textAlignVertical="top"
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
    textAlignVertical: 'top',
    variants: {
      error: {
        true: { borderColor: theme.colors.error },
      },
    },
  },
}));
