import React, {useEffect, useState, useCallback} from 'react';
import {ToastAndroid, ActivityIndicator, View} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';

import {LoginNavProp} from '../../navigation/types';
import {AuthFormTemplate, AuthWrapper} from '../../components/templates';
import {EmailInput, PasswordInput} from '../../components/atoms';
import {getLoginValidationSchema} from '../../utils/validation';
import {useSafeNavigation} from '../../hooks';
import {useToast} from '../../hooks/useToast';
import {loadCredentials} from '../../storage/keychain';

import {useStore} from '../../store';
import {useLoginMutation} from '../../graphql/generated';

type LoginValues = {email: string; password: string};

export function LoginScreen() {
  const {navigation} = useSafeNavigation<LoginNavProp>();
  const showToast = useToast();
  const {rememberMe, setAuth, setPendingCredentials} = useStore();

  const [loadingCreds, setLoadingCreds] = useState(true);
  const [pwFromKeychain, setPwFromKeychain] = useState(false);

  // Apollo mutation hook
  const [login, {loading: isLoggingIn}] = useLoginMutation();

  // React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    formState: {errors},
  } = useForm<LoginValues>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: {email: '', password: ''},
  });

  // 1) Preload credentials from Keychain
  useEffect(() => {
    (async () => {
      setLoadingCreds(true);
      if (!rememberMe) {
        setLoadingCreds(false);
        return;
      }
      try {
        const creds = await loadCredentials();
        if (creds) {
          reset({email: creds.username, password: creds.password});
          setPwFromKeychain(true);
        }
      } catch (err) {
        console.warn('Keychain load failed', err);
      } finally {
        setLoadingCreds(false);
      }
    })();
  }, [reset]);

  // 2) Form submit handler
  const onSubmit = useCallback(
    async ({email, password}: LoginValues) => {
      try {
        const {data, errors: gqlErrors} = await login({
          variables: {email, password},
          // optional: you could add errorPolicy or fetchPolicy here
        });

        if (gqlErrors?.length || !data?.login) {
          throw new Error(gqlErrors?.[0]?.message ?? 'Login failed');
        }

        const {user, accessToken, refreshToken} = data.login;

        // Persist into your Zustand auth slice
        setAuth(user, accessToken, refreshToken);

        // If "remember me" is undefined that means that the user hasn't been asked yet
        // so we need to set pending credentials.
        if (rememberMe === undefined) {
          setPendingCredentials(email, password);
        }

        if (pwFromKeychain) {
          // already saving credentials, just let navigator switch
          return;
        }
      } catch (err: any) {
        showToast({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Login failed. Please try again.',
          duration: ToastAndroid.SHORT,
        });
      }
    },
    [login, navigation, pwFromKeychain, setAuth, showToast],
  );

  // 3) Loading UI while we fetch Keychain creds
  if (loadingCreds) {
    return (
      <AuthWrapper>
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator size="large" />
        </View>
      </AuthWrapper>
    );
  }

  // 4) Render form
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
