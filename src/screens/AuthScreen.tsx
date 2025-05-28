import React from 'react';
import {SafeAreaView} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import LoginForm from '../components/organisms/LoginForm';

const AuthScreen = () => {
  const {styles} = useStyles(stylesheet);

  return (
    <SafeAreaView style={styles.container}>
      <LoginForm />
    </SafeAreaView>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));

export default AuthScreen;
