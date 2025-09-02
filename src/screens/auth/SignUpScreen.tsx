import React, {useState} from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';

import {AuthFormTemplate, AuthWrapper} from '#components/templates';
import {EmailInput, PasswordInput, BaseInput} from '#components/atoms';
import {getSignUpValidationSchema} from '#/utils';
import {SignUpNavProp} from '#navigation';
import {useRegisterMutation, type RegisterInput} from '#generated';
import {useStore} from '#store';
import {useAuthErrorHandler, useSafeNavigation} from '#hooks';
import {saveCredentials} from '#/storage/keychain';
import {StyleSheet} from 'react-native-unistyles';
import {RememberMeModal} from './login';

type SignUpValues = RegisterInput & {confirmPassword: string; name: string};

export const SignUpScreen = () => {
  const {navigation, canGoBack, goBack} = useSafeNavigation<SignUpNavProp>();
  const {completeAuthentication, setUserNavigationState, setAuthFlow} =
    useStore();

  const [showRememberModal, setShowRememberModal] = useState(false);
  const [pendingAuthResponse, setPendingAuthResponse] = useState<any>(null);

  // Shared hooks
  const {handleAuthError} = useAuthErrorHandler();

  // Apollo mutation
  const [register, {loading: isRegistering}] = useRegisterMutation();

  // Form setup
  const form = useForm<SignUpValues>({
    resolver: yupResolver(getSignUpValidationSchema()),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Handle remember me choice
  const handleRememberChoice = async (remember: boolean) => {
    setShowRememberModal(false);

    if (!pendingAuthResponse) return;

    const {user, email, password} = pendingAuthResponse;

    // Save user's remember me choice and mark as new user
    if (user?.id) {
      setUserNavigationState(user.id, {
        rememberMeChoice: remember,
        lastLoginTimestamp: Date.now(),
      });

      // Mark as new user in auth flow
      setAuthFlow({
        isNewUser: true,
        requiresVerification: !user.emailVerified,
        loginMethod: 'email',
      });
    }

    // Save credentials if user chose to remember
    if (remember && email && password) {
      try {
        await saveCredentials(email, password);
      } catch (error) {
        console.error('Failed to save credentials:', error);
      }
    }

    // Complete authentication flow
    await completeAuthentication(pendingAuthResponse, remember);
    setPendingAuthResponse(null);
  };

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

      {/* Remember Me Modal */}
      <RememberMeModal
        visible={showRememberModal}
        onAccept={() => handleRememberChoice(true)}
        onDecline={() => handleRememberChoice(false)}
        email={pendingAuthResponse?.email || ''}
      />
    </AuthWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  // Modal styles (same as LoginScreen)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonPrimaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonSecondaryText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
}));
