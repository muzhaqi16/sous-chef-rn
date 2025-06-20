import React from 'react';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import SignUpForm from '../../components/organisms/SignUpForm';
import AuthWrapper from '../../components/templates/AuthWrapper';

export const SignUpScreen = ({}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <AuthWrapper>
      <SignUpForm />
    </AuthWrapper>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
