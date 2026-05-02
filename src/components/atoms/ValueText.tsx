import React from 'react';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export const ValueText: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <Text style={styles.text}>{children}</Text>;
};

const styles = StyleSheet.create(theme => ({
  text: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
  },
}));
