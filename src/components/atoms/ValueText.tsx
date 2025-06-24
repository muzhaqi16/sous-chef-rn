import React from 'react';
import {Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export const ValueText: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const {styles} = useStyles(stylesheet);
  return <Text style={styles.text}>{children}</Text>;
};

const stylesheet = createStyleSheet(theme => ({
  text: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
}));
