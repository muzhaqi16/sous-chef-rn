import React from 'react';
import type { TextInputProps, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FormFieldWrapper } from '#components/atoms/FormFieldWrapper';
import { singleLineInputStyle } from '#components/atoms/singleLineInputStyle';
import {
  ThemedBottomSheetTextInput,
  ThemedTextInput,
  type ThemedBottomSheetTextInputRef,
} from '#components/atoms/themedComponents';
import { assignRef, type FocusableInputRef } from './inputRef';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';
import { useFieldAccessibility } from '#hooks/ui/useFieldAccessibility';

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
  /**
   * The input, for a host that only focuses it (react-hook-form, a chained
   * form). Attached inside a sheet too, where the input is gorhom's.
   */
  ref?: React.Ref<FocusableInputRef>;
  /** The input inside a sheet, as gorhom's own type. */
  sheetRef?: React.Ref<ThemedBottomSheetTextInputRef>;
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
  ref,
  sheetRef,
  ...textInputProps
}) => {
  const contextValue = useIsBottomSheetInput();
  const inSheet = useBottomSheetInput || contextValue;

  const variantStyles = styles.useVariants({
    error: !!error,
    hasTrailing: !!trailing,
    multiline: !!textInputProps.multiline,
  });

  const fieldAccessibility = useFieldAccessibility({
    label,
    required,
    error,
    accessibilityLabel,
    accessibilityHint,
  });
  const inputProps = {
    style: [variantStyles.input, inputStyle],
    accessible: true,
    ...fieldAccessibility,
    accessibilityState: { disabled: textInputProps.editable === false },
    ...textInputProps,
  };

  return (
    <FormFieldWrapper
      label={label}
      error={error}
      required={required}
      containerStyle={containerStyle}
    >
      <View style={variantStyles.inputContainer}>
        {inSheet ? (
          <ThemedBottomSheetTextInput
            ref={node => {
              assignRef(sheetRef, node);
              assignRef(ref, node ?? null);
            }}
            {...inputProps}
          />
        ) : (
          <ThemedTextInput ref={node => assignRef(ref, node)} {...inputProps} />
        )}
        {!!trailing && <View style={variantStyles.trailing}>{trailing}</View>}
      </View>
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  inputContainer: {
    position: 'relative',
  },
  input: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    variants: {
      multiline: {
        false: singleLineInputStyle(theme),
        true: {
          ...theme.type.body,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.base,
          textAlignVertical: 'top',
        },
      },
      error: {
        true: { borderColor: theme.colors.error },
      },
      hasTrailing: {
        true: { paddingRight: theme.sizes.button.md + theme.spacing.sm },
      },
    },
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
