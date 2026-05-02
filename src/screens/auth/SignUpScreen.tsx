import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigation } from '@react-navigation/native';

import { AuthFormTemplate } from '#components/templates/AuthFormTemplate';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { EmailInput } from '#components/atoms/EmailInput';
import { PasswordInput } from '#components/atoms/PasswordInput';
import { NameInput } from '#components/atoms/NameInput';
import { getSignUpValidationSchema } from '#/utils/validation/auth';
import { type RegisterInput } from '../../graphql/generated/schemaTypes';
import { authService } from '#/services/authService';
import { useAppStore } from '#store/useAppStore';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';

type SignUpValues = RegisterInput & { confirmPassword: string; name: string };

export const SignUpScreen = (): React.JSX.Element => {
  const navigation = useNavigation();
  const isRegistering = useAppStore(state => state.authIsLoading);
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
      await authService.register(input); // Uses default rememberMe=true
    } catch (err: any) {
      authService.handleAuthError(err, 'Registration');
    }
  };

  return (
    <AuthWrapper testID="signup-screen">
      <AuthFormTemplate<SignUpValues>
        title="Create account"
        subtitle="Join Sous Chef today"
        onBackPress={() => navigation.goBack()}
        fields={[
          {
            name: 'name',
            label: 'Name',
            placeholder: 'e.g John Doe',
            component: NameInput,
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
