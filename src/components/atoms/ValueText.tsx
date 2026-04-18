import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from './Text';

export const ValueText: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <Text tone="secondary" style={styles.text}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create(theme => ({
  text: {
    marginRight: theme.spacing.sm,
  },
}));
