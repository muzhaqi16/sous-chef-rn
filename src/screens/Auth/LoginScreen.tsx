import React, {useEffect} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';

import {LoginNavProp} from '#navigation/types';
import {AuthFormTemplate, AuthWrapper} from '#components/templates';
import {EmailInput, PasswordInput} from '#components/atoms';
import {getLoginValidationSchema} from '#utils/validation';
import {useStore} from '#store';
import {useLoginMutation, type LoginInput} from '#generated';
import {
  useCredentialLoader,
  useAuthErrorHandler,
  useSafeNavigation,
  usePostAuthNavigation,
} from '#hooks';

export function LoginScreen() {
  const {navigation, canGoBack, goBack} = useSafeNavigation<LoginNavProp>();
  const {rememberMe, setAuthFromResponse, setPendingCredentials} = useStore();

  // Shared hooks
  const {loadingCreds, pwFromKeychain, loadStoredCredentials} =
    useCredentialLoader(rememberMe);
  const {handleAuthError} = useAuthErrorHandler();
  const {navigateAfterAuth} = usePostAuthNavigation();

  // Apollo mutation
  const [login, {loading: isLoggingIn}] = useLoginMutation();

  // Form setup
  const form = useForm<LoginInput>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: {email: '', password: ''},
  });

  // Load credentials on mount
  useEffect(() => {
    loadStoredCredentials().then(credentials => {
      if (credentials) {
        form.reset(credentials);
      }
    });
  }, [loadStoredCredentials, form]);

  // Submit handler
  const onSubmit = async (input: LoginInput) => {
    try {
      const response = await login({
        variables: {input},
        errorPolicy: 'all',
      });

      if (response.data?.login) {
        const loginData = response.data.login;
        setAuthFromResponse(loginData);

        if (rememberMe === undefined) {
          setPendingCredentials(input.email, input.password);
        }

        navigateAfterAuth(loginData.user, rememberMe);
      } else {
        throw new Error('Login failed: No data returned');
      }
    } catch (err: any) {
      handleAuthError(err, 'Login failed. Please try again.');
    }
  };

  if (loadingCreds) {
    return (
      <AuthWrapper>
        <View style={{flex: 1, justifyContent: 'center'}}>
          <ActivityIndicator size="large" />
        </View>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <AuthFormTemplate<LoginInput>
        title="Sign in to Sous Chef App"
        subtitle="Access your pantry and more"
        onBackPress={canGoBack ? goBack : undefined}
        fields={[
          {name: 'email', label: 'Email address', component: EmailInput},
          {
            name: 'password',
            label: 'Password',
            component: PasswordInput,
            props: {showToggle: !pwFromKeychain},
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        linkText="Forgot password?"
        onLinkPress={() => navigation.navigate('ForgotPassword')}
        submitText={isLoggingIn ? 'Logging in…' : 'Login'}
        onSubmit={form.handleSubmit(onSubmit)}
        footerText="Don't have an account?"
        footerLinkText="Sign Up"
        onFooterLinkPress={() => navigation.navigate('SignUp')}
        isLoading={isLoggingIn}
      />
    </AuthWrapper>
  );
}
