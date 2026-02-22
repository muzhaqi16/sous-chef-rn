import React from 'react';
import {View, Text, ViewStyle} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface FormFieldWrapperProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * A reusable wrapper component for form fields that provides consistent
 * label, required indicator, and error message styling.
 */
export const FormFieldWrapper: React.FC<FormFieldWrapperProps> = ({
  label,
  error,
  required = false,
  children,
  containerStyle,
  accessibilityLabel,
}) => {
  return (
    <View
      style={[styles.container, containerStyle]}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="none"
    >
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.semibold,
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
