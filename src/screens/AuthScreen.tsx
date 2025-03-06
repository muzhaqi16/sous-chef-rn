import React, {useState} from 'react';
import {View, Button, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import AuthForm from '../components/organisms/AuthForm';

const AuthScreen = () => {
  const {styles} = useStyles(stylesheet);
  const [isLogin, setIsLogin] = useState(true);

  return (
    <View style={styles.container}>
      <AuthForm isLogin={isLogin} />
      <Button
        title={isLogin ? 'Switch to Sign Up' : 'Switch to Login'}
        onPress={() => setIsLogin(!isLogin)}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));

export default AuthScreen;
