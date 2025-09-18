import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigation } from '@react-navigation/native';

import { AuthFormTemplate, AuthWrapper } from '#components/templates';
import { EmailInput, PasswordInput, BaseInput } from '#components/atoms';
import { getSignUpValidationSchema } from '#/utils';
import { type RegisterInput } from '#generated';
import { useAuth, useAuthNavigation } from '#hooks';
import { RememberMeModal } from './RememberMeModal';

type SignUpValues = RegisterInput & { confirmPassword: string; name: string };

export const SignUpScreen = () => {
  const navigation = useNavigation();
  const {
    handleAuthError,
    register: authRegister,
    isLoading: isRegistering,
  } = useAuth();

  const [showRememberModal, setShowRememberModal] = useState(false);
  const [pendingAuthResponse, setPendingAuthResponse] = useState<any>(null);
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

  const handleRememberChoice = async (remember: boolean) => {
    setShowRememberModal(false);

    if (!pendingAuthResponse) return;

    const { input } = pendingAuthResponse;

    // Use the consolidated register function
    await authRegister(input, remember);

    // Navigation to verification or onboarding happens automatically
    setPendingAuthResponse(null);
  };

  const onSubmit = async (data: SignUpValues) => {
    const { name, email, password } = data;
    const input: RegisterInput = { name, email, password };

    try {
      // Show remember me modal for new users
      setPendingAuthResponse({
        email,
        password,
        input,
      });
      setShowRememberModal(true);
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

      <RememberMeModal
        visible={showRememberModal}
        onAccept={() => handleRememberChoice(true)}
        onDecline={() => handleRememberChoice(false)}
        email={pendingAuthResponse?.email || ''}
      />
    </AuthWrapper>
  );
};
