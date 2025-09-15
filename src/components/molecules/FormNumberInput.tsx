import React from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
} from 'react-native';
import {useUnistyles} from 'react-native-unistyles';

interface FormNumberInputProps extends Omit<TextInputProps, 'style' | 'keyboardType'> {
  label: string;
  error?: string;
  required?: boolean;
  containerStyle?: any;
  inputStyle?: any;
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
  const {theme} = useUnistyles();
  
  const handleChangeText = (text: string) => {
    // Allow only numbers and decimal point for decimal-pad
    if (keyboardType === 'decimal-pad') {
      const sanitized = text.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = sanitized.split('.');
      const result = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
      onChangeText?.(result);
    } else {
      // For numeric/number-pad, only allow digits
      const sanitized = text.replace(/[^0-9]/g, '');
      onChangeText?.(sanitized);
    }
  };
  
  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
      ...containerStyle,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    required: {
      color: '#dc3545',
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType}
        onChangeText={handleChangeText}
        {...textInputProps}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};