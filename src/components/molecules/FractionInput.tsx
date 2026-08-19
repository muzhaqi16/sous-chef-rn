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
  /** Use BottomSheetTextInput for proper keyboard handling inside bottom sheets */
  useBottomSheetInput?: boolean;
  /** Show red asterisk to indicate required field */
  required?: boolean;
}

/**
 * FractionInput component for accepting fractional quantities
 *
 * Accepts formats:
 * - Decimals: "1.5", "0.75", "2"
 * - Simple fractions: "1/4", "3/4", "1/2"
 * - Mixed numbers: "1 1/4", "2 3/4"
 *
 * Validation pattern: ^\d+(\s+\d+\/\d+)?$|^\d+\/\d+$|^\d+\.?\d*$
 */
export const FractionInput: React.FC<FractionInputProps> = ({
  value,
  onChangeText,
  placeholder = 'e.g., 1 1/4 or 1.5',
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

  // Validation regex for fraction input
  const isValidFormat = (text: string): boolean => {
    if (!text || text.trim() === '') return true; // Empty is valid

    // Pattern: whole numbers, decimals, simple fractions (1/4), or mixed numbers (1 1/4)
    const pattern = /^\d+(\s+\d+\/\d+)?$|^\d+\/\d+$|^\d+\.?\d*$/;
    return pattern.test(text.trim());
  };

  const handleChangeText = (text: string) => {
    // Allow typing even if invalid (for better UX), but validate on blur
    onChangeText(text);
  };

  const hasError = !!(error || (value && !isValidFormat(value)));

  styles.useVariants({
    focused: isFocused,
    error: hasError,
    disabled,
  });

  return (
    <FormFieldWrapper
      label={label || ''}
      error={hasError ? error || 'Use format: 1/4, 1 1/4, or 1.5' : undefined}
      required={required}
    >
      <InputComponent
        style={styles.input}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        keyboardType={keyboardType}
        editable={!disabled}
        selectTextOnFocus
        testID={testID}
      />
      {!hasError && !!value && !!isFocused && (
        <Text size="xs" tone="secondary" style={styles.hintText}>
          {localizeNumericHint(t('fractionInput.formatsHint'))}
        </Text>
      )}
    </FormFieldWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    variants: {
      focused: {
        true: {
          borderColor: theme.colors.primary,
          borderWidth: 2,
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
