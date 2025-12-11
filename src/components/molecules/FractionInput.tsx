import React, {useState} from 'react';
import {TextInput, View, Text} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import { Label } from '#components/atoms';

interface FractionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  label?: string;
  disabled?: boolean;
  testID?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'numbers-and-punctuation';
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
}) => {
  const { theme } = useUnistyles();
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

  const hasError = error || (value && !isValidFormat(value));

  return (
    <View style={styles.container}>
      {label && <Label>{label}</Label>}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        keyboardType={keyboardType}
        editable={!disabled}
        selectTextOnFocus
        testID={testID}
      />
      {hasError && (
        <Text style={styles.errorText}>
          {error || 'Use format: 1/4, 1 1/4, or 1.5'}
        </Text>
      )}
      {!hasError && value && isFocused && (
        <Text style={styles.hintText}>
          Formats: 1/4, 1 1/4, 0.75, or 2
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    height: theme.sizes.input.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.inputText,
    backgroundColor: theme.colors.inputBackground,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceVariant,
    opacity: 0.6,
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  hintText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
}));
