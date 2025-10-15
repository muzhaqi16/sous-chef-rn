import React, {useState} from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {useNavigation} from '@react-navigation/native';
import {StyleSheet} from 'react-native-unistyles';

import {AuthFormTemplate, AuthWrapper} from '#components/templates';
import {EmailInput, PasswordInput, BaseInput} from '#components/atoms';
import {getSignUpValidationSchema} from '#/utils';
import {useRegisterMutation, type RegisterInput} from '#generated';
import {useStore} from '#store';
import {useAuthErrorHandler, useAuthNavigation} from '#hooks';
import {saveCredentials} from '#/storage/keychain';
import {RememberMeModal} from './RememberMeModal';

type SignUpValues = RegisterInput & {confirmPassword: string; name: string};

export const SignUpScreen = () => {
  const navigation = useNavigation();
  const {setAuth, setRememberMe} = useStore();
  const {handleAuthError} = useAuthErrorHandler();

  const [showRememberModal, setShowRememberModal] = useState(false);
  const [pendingAuthResponse, setPendingAuthResponse] = useState<any>(null);
  const [register, {loading: isRegistering}] = useRegisterMutation();
  const {navigateToLogin} = useAuthNavigation();

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

    const {user, accessToken, refreshToken, email, password} =
      pendingAuthResponse;

    if (remember && email && password) {
      try {
        await saveCredentials(email, password);
      } catch (error) {
        console.error('Failed to save credentials:', error);
      }
    }

    // Update auth state
    setRememberMe(remember);
    setAuth(user, accessToken, refreshToken);

    // Navigation to verification or onboarding happens automatically
    setPendingAuthResponse(null);
  };

  const onSubmit = async (data: SignUpValues) => {
    const {name, email, password} = data;
    const input: RegisterInput = {name, email, password};

    try {
      const response = await register({
        variables: {input},
      });

      if (response.data?.register) {
        const registerData = response.data.register;

        // Show remember me modal for new users
        setPendingAuthResponse({
          ...registerData,
          email,
          password,
        });
        setShowRememberModal(true);
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
        onBackPress={() => navigation.goBack()}
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
