import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigation } from '@react-navigation/native';

import { AuthFormTemplate, AuthWrapper } from '#components/templates';
import { EmailInput, PasswordInput, BaseInput } from '#components/atoms';
import { getSignUpValidationSchema } from '#/utils';
import { type RegisterInput } from '#generated';
import { useAuth, useAuthNavigation } from '#hooks';

type SignUpValues = RegisterInput & { confirmPassword: string; name: string };

export const SignUpScreen = () => {
  const navigation = useNavigation();
  const { register, handleAuthError, isLoading: isRegistering } = useAuth();
  const { navigateToLogin } = useAuthNavigation();

  const form = useForm<SignUpValues>({
    resolver: yupResolver(getSignUpValidationSchema()),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignUpValues) => {
    const { name, email, password } = data;
    const input: RegisterInput = { name, email, password };

    try {
      await register(input); // Uses default rememberMe=true
    } catch (err: any) {
      handleAuthError(err, 'Registration');
    }
  };

  return (
    <AuthWrapper testID="signup-screen">
      <AuthFormTemplate<SignUpValues>
        title="Create account"
        subtitle="Join Sous Chef App today"
        onBackPress={() => navigation.goBack()}
        fields={[
          {
            name: 'name',
            label: 'Name',
            placeholder: 'e.g John Doe',
            component: BaseInput,
            props: { testID: 'signup-name-input' },
          },
          {
            name: 'email',
            label: 'Email address',
            component: EmailInput,
            props: { testID: 'signup-email-input' },
          },
          {
            name: 'password',
            label: 'Password',
            component: PasswordInput,
            props: { testID: 'signup-password-input' },
          },
          {
            name: 'confirmPassword',
            label: 'Confirm Password',
            component: PasswordInput,
            props: { testID: 'signup-confirm-password-input' },
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        submitText={isRegistering ? 'Creating account…' : 'Sign Up'}
        submitButtonTestID="signup-submit-button"
        onSubmit={form.handleSubmit(onSubmit)}
        footerText="Already have an account?"
        footerLinkText="Sign In"
        footerLinkTestID="signup-login-link"
        onFooterLinkPress={() => navigateToLogin()}
        isLoading={isRegistering}
      />
    </AuthWrapper>
  );
};
