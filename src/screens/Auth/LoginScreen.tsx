import React from 'react';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import LoginForm from '../../components/organisms/LoginForm';
import AuthWrapper from '../../components/templates/AuthWrapper';

export const LoginScreen = ({}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <AuthWrapper>
      <LoginForm />
    </AuthWrapper>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
