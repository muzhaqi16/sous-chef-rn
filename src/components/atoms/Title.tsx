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
    fontFamily: 'DM Sans',
    fontWeight: '700',
    // fontStyle: 'normal', // React Native defaults to normal
    fontSize: theme.fonts.size['2xl'],
    lineHeight: theme.fonts.size['2xl'] * 1.2, // Adjust line height as needed
    letterSpacing: 0,
    color: theme.colors.textPrimary,
    marginBottom: 16,
    // leading-trim is not supported in React Native
  },
}));

export default Title;
