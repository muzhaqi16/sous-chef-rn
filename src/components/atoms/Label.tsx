import React from 'react';
import {Text} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

export const Label: React.FC<{children: React.ReactNode}> = ({children}) => {
  return <Text style={styles.text}>{children}</Text>;
};

const styles = StyleSheet.create(theme => ({
  text: {
    fontSize: 16,
    paddingVertical: 8,
    color: theme.colors.textPrimary,
  },
}));
