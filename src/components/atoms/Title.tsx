import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from './Text';

interface TitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export const Title: React.FC<TitleProps> = ({ children, style }) => {
  return (
    <Text role="title" style={[styles.title, style]}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create(theme => ({
  title: {
    marginBottom: theme.spacing.md,
  },
}));

export default Title;
