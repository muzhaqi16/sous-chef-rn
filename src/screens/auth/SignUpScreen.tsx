import React, {useEffect} from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';

import {AuthFormTemplate, AuthWrapper} from '#components/templates';
import {EmailInput, PasswordInput, BaseInput} from '#components/atoms';
import {getSignUpValidationSchema} from '#utils/validation';
import {SignUpNavProp} from '#navigation';
import {useRegisterMutation, type RegisterInput} from '#generated';
import {useStore} from '#store';
import {
  useAuthErrorHandler,
  useSafeNavigation,
  usePostAuthNavigation,
} from '#hooks';

type SignUpValues = RegisterInput & {confirmPassword: string; name: string};

export const SignUpScreen = () => {
  const {navigation, canGoBack, goBack} = useSafeNavigation<SignUpNavProp>();
  const {setAuthFromResponse, setPendingCredentials} = useStore();

  // Shared hooks
  const {handleAuthError} = useAuthErrorHandler();
  const {navigateToEmailVerification} = usePostAuthNavigation();

  // Apollo mutation
  const [register, {loading: isRegistering}] = useRegisterMutation();

  // Form setup
  const form = useForm<SignUpValues>({
    resolver: yupResolver(getSignUpValidationSchema()),
    defaultValues: {
      name: '133 N',
      email: '133nmolest@gmail.com',
      password: 'Test123!',
      confirmPassword: 'Test123!',
    },
  });

  // Submit handler
  const onSubmit = async (data: SignUpValues) => {
    const {name, email, password} = data;
    const input: RegisterInput = {name, email, password};

    try {
      const response = await register({
        variables: {input},
      });
      if (response.data?.register) {
        const registerData = response.data.register;
        setAuthFromResponse(registerData);
        setPendingCredentials(email, password);
        navigateToEmailVerification(email, password);
      } 
    } catch (err: any) {
      handleAuthError(err, 'Registration failed. Please try again.');
    }
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<SignUpValues>
        title="Create account"
        subtitle="Join Sous Chef App today"
        onBackPress={canGoBack ? goBack : undefined}
        fields={[
          {
            name: 'name',
            label: 'Name',
            placeholder: 'e.g John Doe',
            component: BaseInput,
          },
          {name: 'email', label: 'Email address', component: EmailInput},
          {name: 'password', label: 'Password', component: PasswordInput},
          {
            name: 'confirmPassword',
            label: 'Confirm Password',
            component: PasswordInput,
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        linkText="Already have an account?"
        onLinkPress={() => navigation.navigate('Login')}
        submitText={isRegistering ? 'Creating account…' : 'Sign Up'}
        onSubmit={form.handleSubmit(onSubmit)}
        footerText="Already have an account?"
        footerLinkText="Sign In"
        onFooterLinkPress={() => navigation.navigate('Login')}
        isLoading={isRegistering}
      />
    </AuthWrapper>
  );
};
