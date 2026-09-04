import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { FormFieldWrapper } from '#components/atoms/FormFieldWrapper';
import {
  ThemedBottomSheetTextInput,
  ThemedTextInput,
} from '#components/atoms/themedComponents';
import { useIsBottomSheetInput } from '#context/BottomSheetInputContext';
import { Text } from '#components/atoms/Text';
import { localizeNumericHint } from '#/utils/formatters/number';

interface FractionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  label?: string;
  disabled?: boolean;
  testID?: string;
  keyboardType?:
    | 'default'
    | 'numeric'
    | 'decimal-pad'
    | 'numbers-and-punctuation';
  useBottomSheetInput?: boolean;
  required?: boolean;
}

/** Accepts decimals ("1.5"), simple fractions ("1/4") and mixed numbers ("1 1/4"). */
export const FractionInput: React.FC<FractionInputProps> = ({
  value,
  onChangeText,
  placeholder,
  error,
  label,
  disabled = false,
  testID,
  keyboardType = 'numbers-and-punctuation',
  useBottomSheetInput = false,
  required = false,
}) => {
  const { t } = useTranslation();
  const contextValue = useIsBottomSheetInput();
  const InputComponent =
    useBottomSheetInput || contextValue
      ? ThemedBottomSheetTextInput
      : ThemedTextInput;
  const [isFocused, setIsFocused] = useState(false);

  // `,` as well as `.`: the keypad on a comma-locale device offers no `.` at
  // all, and `parseFractionalInput` already accepts both — without it here the
  // field rejects a value the parser handles.
  const isValidFormat = (text: string): boolean => {
    if (!text || text.trim() === '') return true; // Empty is valid

    const pattern = /^\d+(\s+\d+\/\d+)?$|^\d+\/\d+$|^\d+[.,]?\d*$/;
    return pattern.test(text.trim());
  };

  const handleChangeText = (text: string) => {
    // Typing an invalid value is allowed; validation happens on blur.
    onChangeText(text);
  };

  const hasError = !!(error || (value && !isValidFormat(value)));
  // Same vocabulary as the hint below, with the device's separator substituted.
  const formatsHint = localizeNumericHint(t('fractionInput.formatsHint'));

  styles.useVariants({
    focused: isFocused,
    error: hasError,
    disabled,
  });

  return (
    <FormFieldWrapper
      label={label || ''}
      error={hasError ? error || formatsHint : undefined}
      required={required}
    >
      <InputComponent
        style={styles.input}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder ?? formatsHint}
        keyboardType={keyboardType}
        editable={!disabled}
        selectTextOnFocus
        testID={testID}
      />
      {!hasError && !!value && !!isFocused && (
        <Text role="caption" tone="secondary" style={styles.hintText}>
          {formatsHint}
        </Text>
      )}
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
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    variants: {
      focused: {
        true: {
          borderColor: theme.colors.primary,
          borderWidth: theme.borderWidth.medium,
        },
      },
      error: {
        true: { borderColor: theme.colors.error },
      },
      disabled: {
        true: {
          backgroundColor: theme.colors.surfaceVariant,
          opacity: theme.opacity.disabled,
        },
      },
    },
  },
  hintText: {
    marginTop: theme.spacing.xs,
  },
}));
