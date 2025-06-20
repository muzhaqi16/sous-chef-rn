import React from 'react';
import {SafeAreaView} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

const AuthWrapper = ({children}: any) => {
  const {styles} = useStyles(stylesheet);

  return <SafeAreaView style={styles.container}>{children}</SafeAreaView>;
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

export default AuthWrapper;
