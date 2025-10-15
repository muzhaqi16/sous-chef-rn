import React from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
} from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface FormInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  required?: boolean;
  containerStyle?: any;
  inputStyle?: any;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  required = false,
  containerStyle,
  inputStyle,
  ...textInputProps
}) => {
  const { theme } = useUnistyles();

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
        {...textInputProps}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};
