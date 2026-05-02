import React from 'react';
import { Text, TextStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface LabelProps {
  children: React.ReactNode;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  weight?: 'regular' | 'medium' | 'semibold';
  style?: TextStyle;
}

export const Label: React.FC<LabelProps> = ({
  children,
  required = false,
  size = 'md',
  weight = 'medium',
  style,
}) => {
  const { theme } = useUnistyles();

  const sizeMap = {
    sm: theme.fonts.size.sm,
    md: theme.fonts.size.md,
    lg: theme.fonts.size.lg,
  };

  const weightMap = {
    regular: theme.fonts.weight.regular,
    medium: theme.fonts.weight.medium,
    semibold: theme.fonts.weight.semibold,
  };

  return (
    <Text
      style={[
        styles.text,
        { fontSize: sizeMap[size], fontWeight: weightMap[weight] },
        style,
      ]}
    >
      {children}
      {!!required && <Text style={styles.required}> *</Text>}
    </Text>
  );
};

const styles = StyleSheet.create(theme => ({
  text: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  required: {
    color: theme.colors.error,
  },
}));
