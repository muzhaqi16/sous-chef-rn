import React from 'react';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { Label } from '#components/atoms/Label';
import { kitTestIDs } from '#components/testIDs';

interface FormFieldWrapperProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  containerStyle?: ViewStyle;
  accessibilityLabel?: string;
  /** The field's input id; its error text takes `kitTestIDs.inputError` of it. */
  inputTestID?: string;
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
  inputTestID,
}) => {
  return (
    <View
      style={[styles.container, containerStyle]}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="none"
    >
      <Label required={required}>{label}</Label>
      {children}
      {error ? (
        <Text
          role="error"
          tone="error"
          style={styles.errorText}
          testID={inputTestID ? kitTestIDs.inputError(inputTestID) : undefined}
        >
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
  errorText: {
    marginTop: theme.spacing.xs,
  },
}));
