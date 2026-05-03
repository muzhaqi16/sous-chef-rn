import React from 'react';
import { View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

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
      <Text size="base" weight="semibold" style={styles.label}>
        {label}
        {!!required && <Text tone="error"> *</Text>}
      </Text>
      {children}
      {error ? (
        <Text size="sm" tone="error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
}));
