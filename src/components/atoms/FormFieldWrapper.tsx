import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface FormFieldWrapperProps {
  label?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  accessibilityLabel?: string;
}

export const FormFieldWrapper: React.FC<FormFieldWrapperProps> = ({
  label,
  error,
  required = false,
  children,
  containerStyle,
  accessibilityLabel,
}) => {
  const fullLabel = accessibilityLabel || label;
  const labelWithRequired = required ? `${fullLabel}, required` : fullLabel;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={styles.label}
          accessibilityRole="text"
          accessibilityLabel={labelWithRequired}
        >
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      {children}
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

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  required: {
    color: theme.colors.error,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
}));
