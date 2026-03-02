import React from 'react';
import {TextInput, TextInputProps, ViewStyle} from 'react-native';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {FormFieldWrapper} from '../atoms/FormFieldWrapper';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';

interface FormTextAreaProps extends Omit<TextInputProps, 'style' | 'multiline'> {
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
  const InputComponent = (useBottomSheetInput || contextValue) ? BottomSheetTextInput : TextInput;
  const {theme} = useUnistyles();

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
        style={[
          styles.input,
          {height: inputHeight},
          error && styles.inputError,
          inputStyle,
        ]}
        placeholderTextColor={theme.colors.textSecondary}
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
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: theme.colors.error,
  },
}));
