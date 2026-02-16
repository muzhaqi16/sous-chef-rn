import React from 'react';
import {Text, TextStyle} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface TitleProps {
  children: React.ReactNode;
  style?: TextStyle;
}

export const Title: React.FC<TitleProps> = ({children, style}) => {
  return <Text style={[styles.title, style]}>{children}</Text>;
};
const styles = StyleSheet.create(theme => ({
  title: {
    fontWeight: '700',
    fontSize: theme.fonts.size['2xl'],
    lineHeight: theme.fonts.size['2xl'] * 1.2,
    letterSpacing: 0,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
}));

export default Title;
