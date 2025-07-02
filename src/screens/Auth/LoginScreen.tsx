import React, {useEffect, useState, useCallback} from 'react';
import {ToastAndroid, ActivityIndicator, View} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';

import {LoginNavProp} from '../../navigation/types';
import {AuthFormTemplate, AuthWrapper} from '../../components/templates';
import {EmailInput, PasswordInput} from '../../components/atoms';
import {getLoginValidationSchema} from '../../utils/validation';
import {useStore} from '../../store';
import {useToast, useSafeNavigation} from '../../hooks';
import {loadCredentials} from '../../storage/keychain';

type LoginValues = {email: string; password: string};

export function LoginScreen() {
  const {navigation, goBack} = useSafeNavigation<LoginNavProp>();
  const showToast = useToast();
  const authenticate = useStore(s => s.authenticate);
  const setAuth = useStore(s => s.setAuth);

  const [loadingCreds, setLoadingCreds] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [pwFromKeychain, setPwFromKeychain] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: {errors},
  } = useForm<LoginValues>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: {email: '', password: ''},
  });

  // 1) Try to load (and prompt) via our helper
  useEffect(() => {
    (async () => {
      try {
        const creds = await loadCredentials();
        if (creds) {
          reset({email: creds.username, password: creds.password});
          setPwFromKeychain(true);
        }
      } finally {
        setLoadingCreds(false);
      }
    })();
  }, [reset]);

  // 2) Submit: either auto-commit or navigate to “Remember me”
  const onSubmit = useCallback(
    async ({email, password}: LoginValues) => {
      if (isLoggingIn) return;
      setIsLoggingIn(true);

      const result = await authenticate(email, password);
      if ('error' in result) {
        showToast({
          type: 'error',
          message:
            typeof result.error === 'string'
              ? result.error
              : 'Login failed. Please try again.',
          duration: ToastAndroid.SHORT,
        });
        setIsLoggingIn(false);
        return;
      }

      if (pwFromKeychain) {
        // user already unlocked Keychain → commit straight into store
        setAuth(result.user, result.accessToken, result.refreshToken);
        // no manual navigation — root navigator will switch stacks
      } else {
        // first-time login → offer “Remember me?”
        navigation.navigate('RememberLoginInfo', {
          email,
          password,
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      }
    },
    [authenticate, isLoggingIn, navigation, showToast, pwFromKeychain, setAuth],
  );

  // 3) show spinner while we check Keychain
  if (loadingCreds) {
    return (
      <AuthWrapper>
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator size="large" />
        </View>
      </AuthWrapper>
    );
  }

  // 4) render your form
  return (
    <AuthWrapper>
      <AuthFormTemplate<LoginValues>
        title="Sign in to Sous Chef App"
        subtitle="Access your pantry and more"
        onBackPress={() => navigation.goBack()}
        fields={[
          {name: 'email', label: 'Email address', component: EmailInput},
          {
            name: 'password',
            label: 'Password',
            component: PasswordInput,
            props: {showToggle: !pwFromKeychain},
          },
        ]}
        control={control}
        errors={errors}
        linkText="Forgot password?"
        onLinkPress={() => navigation.navigate('ForgotPassword')}
        submitText={isLoggingIn ? 'Logging in…' : 'Login'}
        onSubmit={handleSubmit(onSubmit)}
        footerText="Don't have an account?"
        footerLinkText="Sign Up"
        onFooterLinkPress={() => navigation.navigate('SignUp')}
      />
    </AuthWrapper>
  );
}
