import React from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useUnistyles } from 'react-native-unistyles';
import { Label } from '#components/atoms';

interface FormInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  required?: boolean;
  containerStyle?: any;
  inputStyle?: any;
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
  const { theme } = useUnistyles();

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
      ...containerStyle,
    },
    input: {
      borderWidth: 1,
      borderColor: error ? '#dc3545' : theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      ...inputStyle,
    },
    errorText: {
      fontSize: 14,
      color: '#dc3545',
      marginTop: 4,
    },
  });

  // Generate accessibility label with required indicator if needed
  const inputLabel = accessibilityLabel || label;
  const fullLabel = required ? `${inputLabel}, required` : inputLabel;
  const fullHint = error
    ? `${accessibilityHint || ''}${
        accessibilityHint ? '. ' : ''
      }Error: ${error}`
    : accessibilityHint;

  return (
    <View style={styles.container}>
      <Label required={required}>{label}</Label>
      <InputComponent
        style={styles.input}
        placeholderTextColor={theme.colors.textSecondary}
        accessible={true}
        accessibilityLabel={fullLabel}
        accessibilityHint={fullHint}
        accessibilityState={{
          disabled: textInputProps.editable === false,
        }}
        {...textInputProps}
      />
      {error && (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
    </View>
  );
};
