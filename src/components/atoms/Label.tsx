import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text, type TextSize, type TextWeight } from './Text';

type LabelSize = Extract<TextSize, 'sm' | 'md' | 'lg'>;
type LabelWeight = Extract<TextWeight, 'regular' | 'medium' | 'semibold'>;

interface LabelProps {
  children: React.ReactNode;
  required?: boolean;
  size?: LabelSize;
  weight?: LabelWeight;
  style?: StyleProp<TextStyle>;
}

export const Label: React.FC<LabelProps> = ({
  children,
  required = false,
  size = 'md',
  weight = 'medium',
  style,
}) => {
  return (
    <Text
      variant="label"
      size={size}
      weight={weight}
      style={[styles.container, style]}
    >
      {children}
      {!!required && <Text tone="error"> *</Text>}
    </Text>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.sm,
  },
}));
