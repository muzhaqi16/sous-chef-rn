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
      handleAuthError(err, 'Registration failed. Please try again.');
    }
  };

  return (
    <AuthWrapper>
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
          },
          { name: 'email', label: 'Email address', component: EmailInput },
          { name: 'password', label: 'Password', component: PasswordInput },
          {
            name: 'confirmPassword',
            label: 'Confirm Password',
            component: PasswordInput,
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        submitText={isRegistering ? 'Creating account…' : 'Sign Up'}
        onSubmit={form.handleSubmit(onSubmit)}
        footerText="Already have an account?"
        footerLinkText="Sign In"
        onFooterLinkPress={() => navigateToLogin()}
        isLoading={isRegistering}
      />
    </AuthWrapper>
  );
};
