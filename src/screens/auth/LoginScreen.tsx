import React, {useEffect, useState, useCallback} from 'react';
import {View, TouchableOpacity, Text, Alert} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {Icon} from '#utils';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

import {AuthFormTemplate, AuthWrapper} from '#components/templates';
import {EmailInput, PasswordInput} from '#components/atoms';
import {getLoginValidationSchema} from '#/utils';
import {useStore} from '#store';
import {useLoginMutation, type LoginInput} from '#generated';
import {
  useAuthErrorHandler,
  useCredentialManager,
  useAuthNavigation,
} from '#hooks';
import {getEmailOnly, saveCredentials} from '#/storage/keychain';
import {RememberMeModal} from './RememberMeModal';

const obscureEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  const [localPart, domain] = email.split('@');
  const visibleChars = Math.min(2, Math.floor(localPart.length / 3));
  const obscured =
    localPart.substring(0, visibleChars) +
    '***' +
    localPart.substring(Math.max(localPart.length - 1, visibleChars));
  return `${obscured}@${domain}`;
};

export function LoginScreen() {
  const {theme} = useUnistyles();
  const {setAuth, rememberMe, setRememberMe, hasStoredCredentials} = useStore();

  const [savedEmail, setSavedEmail] = useState<string>('');
  const [showRememberModal, setShowRememberModal] = useState(false);
  const [pendingAuthResponse, setPendingAuthResponse] = useState<any>(null);
  const [isManualLogin, setIsManualLogin] = useState(false);
  const [userHasTypedManually, setUserHasTypedManually] = useState(false);

  const {loadStoredCredentials, isLoadingCredentials} = useCredentialManager();
  const {handleAuthError} = useAuthErrorHandler();
  const {navigateToForgotPassword, navigateToSignUp} = useAuthNavigation();
  const [login, {loading: isLoggingIn}] = useLoginMutation();

  const form = useForm<LoginInput>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: {email: '', password: ''},
  });

  // Load saved email on mount
  useEffect(() => {
    let isMounted = true;

    const loadEmail = async () => {
      if (hasStoredCredentials) {
        try {
          const email = await getEmailOnly();
          if (isMounted && email) {
            setSavedEmail(email);
            form.setValue('email', obscureEmail(email));
          }
        } catch (error) {
          console.error('Error loading saved email:', error);
        }
      }
    };

    loadEmail();
    return () => {
      isMounted = false;
    };
  }, [hasStoredCredentials, form]);

  // Detect manual typing to disable biometric authentication
  useEffect(() => {
    const subscription = form.watch((data) => {
      // If user changes email field from the obscured version, they're typing manually
      if (data.email && savedEmail && !data.email.includes('***') && data.email !== obscureEmail(savedEmail)) {
        setUserHasTypedManually(true);
      }
      // If user types anything in password field, they're doing manual login
      if (data.password && data.password.length > 0) {
        setUserHasTypedManually(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, savedEmail]);

  // Biometric authentication
  const authenticateWithBiometric = useCallback(async () => {
    if (isLoadingCredentials || userHasTypedManually) return;

    try {
      const credentials = await loadStoredCredentials();
      if (!credentials) return;

      const result = await login({
        variables: {
          input: {
            email: credentials.email,
            password: credentials.password,
          },
        },
      });

      if (result.data?.login) {
        // Just update auth state - navigation happens automatically
        setAuth(
          result.data.login.user,
          result.data.login.accessToken,
          result.data.login.refreshToken,
        );
        setRememberMe(true);
      }
    } catch (error: any) {
      handleAuthError(error, 'Biometric authentication failed');
    }
  }, [
    loadStoredCredentials,
    login,
    setAuth,
    setRememberMe,
    handleAuthError,
    isLoadingCredentials,
  ]);

  // Handle remember me choice
  const handleRememberChoice = async (remember: boolean) => {
    setShowRememberModal(false);

    if (!pendingAuthResponse) return;

    const {user, accessToken, refreshToken, email, password} =
      pendingAuthResponse;

    // Save credentials if user chose to remember and we don't already have stored credentials
    if (remember && email && password && !hasStoredCredentials) {
      // Save credentials without blocking navigation
      saveCredentials(email, password).catch(error => {
        console.error('Failed to save credentials:', error);
        // Don't prevent auth flow if saving fails
      });
    } else if (remember && hasStoredCredentials) {
      console.log('Skipping credential save - credentials already exist in keychain');
    }

    // Update auth state and remember preference
    setRememberMe(remember);
    setAuth(user, accessToken, refreshToken);

    // Navigation will happen automatically via conditional groups
    setPendingAuthResponse(null);
  };

  // Form submission
  const onSubmit = async (input: LoginInput) => {
    try {
      setIsManualLogin(true); // Flag that this is a manual login

      // Determine if this is truly manual input (not using saved credentials)
      const isUsingObscuredEmail = input.email.includes('***');
      const actualEmail = isUsingObscuredEmail && savedEmail ? savedEmail : input.email;

      console.log('LoginScreen: Form submission', {
        inputEmail: input.email,
        isUsingObscuredEmail,
        actualEmail,
        hasStoredCredentials
      });

      const response = await login({
        variables: {
          input: {...input, email: actualEmail},
        },
      });

      if (response.data?.login) {
        const loginData = response.data.login;

        // If rememberMe preference not set AND no stored credentials exist, show modal
        // Skip modal if credentials already exist to prevent biometric prompts
        if (rememberMe === undefined && !hasStoredCredentials) {
          setPendingAuthResponse({
            ...loginData,
            email: actualEmail,
            password: input.password,
          });
          setShowRememberModal(true);
        } else {
          // Direct login with existing preference
          setAuth(
            loginData.user,
            loginData.accessToken,
            loginData.refreshToken,
          );

          // Don't save credentials automatically during manual login
          // Let the user explicitly choose via RememberMeModal if needed
          console.log('Manual login completed - skipping automatic credential save to prevent biometric prompts');
        }
      }
    } catch (err: any) {
      handleAuthError(err, 'Login failed. Please try again.');
    }
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<LoginInput>
        title="Sign in to Sous Chef App"
        subtitle="Access your pantry and more"
        fields={[
          {
            name: 'email',
            label: 'Email address',
            component: EmailInput,
          },
          {
            name: 'password',
            label: 'Password',
            component: PasswordInput,
            props: {showToggle: true},
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        linkText="Forgot password?"
        onLinkPress={() => {
          navigateToForgotPassword();
        }}
        submitText={isLoggingIn ? 'Logging in…' : 'Login'}
        onSubmit={form.handleSubmit(onSubmit)}
        footerText="Don't have an account?"
        footerLinkText="Sign Up"
        onFooterLinkPress={() => {
          navigateToSignUp();
        }}
        isLoading={isLoggingIn}
      />

      {/* Biometric Authentication Bar */}
      {hasStoredCredentials && !userHasTypedManually && (
        <View style={styles.credentialBar}>
          <View style={styles.credentialInfo}>
            <Icon name="lock" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.credentialText}>
              Tap to use saved credentials
            </Text>
          </View>
          <TouchableOpacity
            style={styles.authButton}
            onPress={authenticateWithBiometric}
            disabled={isLoadingCredentials}>
            <Icon
              name="fingerprint"
              size={26}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      )}

      <RememberMeModal
        visible={showRememberModal}
        onAccept={() => handleRememberChoice(true)}
        onDecline={() => handleRememberChoice(false)}
        email={pendingAuthResponse?.email || ''}
      />
    </AuthWrapper>
  );
}

const styles = StyleSheet.create(theme => ({
  credentialBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  credentialBarPlaceholder: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    opacity: 0, // Make completely invisible while preserving layout
  },
  credentialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  credentialText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 16,
    gap: 4,
  },
  authButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  authButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  credentialActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    padding: 6,
  },
}));
