import React, {useEffect, useState, useCallback} from 'react';
import {View, TouchableOpacity, Text, Alert, Modal} from 'react-native';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import Icon from '@react-native-vector-icons/material-icons';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

import {LoginNavProp} from '#navigation/types';
import {AuthFormTemplate, AuthWrapper} from '#components/templates';
import {EmailInput, PasswordInput} from '#components/atoms';
import {getLoginValidationSchema} from '#/utils/validation/profile';
import {useStore} from '#store';
import {useLoginMutation, type LoginInput} from '#generated';
import {
  useAuthErrorHandler,
  useSafeNavigation,
  useCredentialLoader,
} from '#hooks';
import {
  hasCredentials,
  getEmailOnly,
  saveCredentials,
} from '#/storage/keychain';
import {RememberMeModal} from './RememberMeModal';

// Helper function to obscure email
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
  const {navigation, canGoBack, goBack} = useSafeNavigation<LoginNavProp>();
  const {
    rememberMe,
    completeAuthentication,
    getUserNavigationState,
    setUserNavigationState,
    user,
  } = useStore();

  // State for credential management
  const [savedEmail, setSavedEmail] = useState<string>('');
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRememberModal, setShowRememberModal] = useState(false);
  const [pendingAuthResponse, setPendingAuthResponse] = useState<any>(null);

  // Use the credential loader hook
  const {loadingCreds, pwFromKeychain, loadStoredCredentials} =
    useCredentialLoader(rememberMe);

  // Shared hooks
  const {handleAuthError} = useAuthErrorHandler();

  // Apollo mutation
  const [login, {loading: isLoggingIn}] = useLoginMutation();

  // Form setup - start with empty fields
  const form = useForm<LoginInput>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: {email: '', password: ''},
  });

  // Check for stored credentials on mount (non-blocking)
  useEffect(() => {
    let isMounted = true;

    const checkStoredCredentials = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const hasCreds = await hasCredentials();

        if (!isMounted) return;
        setHasStoredCredentials(hasCreds);

        if (hasCreds) {
          const email = await getEmailOnly();
          if (!isMounted) return;
          if (email) {
            setSavedEmail(email);
            form.setValue('email', obscureEmail(email));
          }
        }
      } catch (error) {
        if (isMounted) {
          setHasStoredCredentials(false);
        }
      }
    };

    checkStoredCredentials();

    return () => {
      isMounted = false;
    };
  }, [form]);

  // Biometric authentication to reveal and fill credentials
  const authenticateAndFillCredentials = async () => {
    if (loadingCreds) return;

    try {
      const credentials = await loadStoredCredentials();

      if (credentials) {
        form.setValue('email', credentials.email);
        form.setValue('password', credentials.password);
        setSavedEmail(credentials.email);
        setIsAuthenticated(true);
      }
    } catch (error: any) {
      if (error.code === 'UserCancel') {
        // User cancelled - do nothing
      } else if (
        error.code === 'BiometryNotAvailable' ||
        error.code === 'BiometryNotEnrolled'
      ) {
        Alert.alert(
          'Biometric Authentication Not Available',
          'Please enable Face ID/Touch ID in your device settings to use saved credentials.',
          [{text: 'OK'}],
        );
      } else {
        Alert.alert(
          'Authentication Failed',
          'Unable to authenticate. Please enter your credentials manually.',
          [{text: 'OK'}],
        );
      }
    }
  };

  // Clear filled credentials
  const clearCredentials = useCallback(() => {
    form.setValue(
      'email',
      hasStoredCredentials && savedEmail ? obscureEmail(savedEmail) : '',
    );
    form.setValue('password', '');
    setIsAuthenticated(false);
  }, [form, hasStoredCredentials, savedEmail]);

  // Handle remember me choice
  const handleRememberChoice = async (remember: boolean) => {
    setShowRememberModal(false);

    if (!pendingAuthResponse) return;

    const {user, email, password} = pendingAuthResponse;

    // Save user's remember me choice
    if (user?.id) {
      setUserNavigationState(user.id, {
        rememberMeChoice: remember,
        lastLoginTimestamp: Date.now(),
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

  // Memoized handlers
  const handleEmailFocus = useCallback(() => {
    const currentEmail = form.getValues('email');
    if (currentEmail.includes('***') && !isAuthenticated) {
      form.setValue('email', '');
    }
  }, [form, isAuthenticated]);

  const handleEmailBlur = useCallback(() => {
    const currentEmail = form.getValues('email');
    if (
      !currentEmail &&
      hasStoredCredentials &&
      savedEmail &&
      !isAuthenticated
    ) {
      form.setValue('email', obscureEmail(savedEmail));
    }
  }, [form, hasStoredCredentials, savedEmail, isAuthenticated]);

  // Memoized EmailInput wrapper
  const EmailInputWrapper = useCallback(
    (props: any) => (
      <EmailInput
        {...props}
        onFocus={() => {
          handleEmailFocus();
          props.onFocus?.();
        }}
        onBlur={() => {
          handleEmailBlur();
          props.onBlur?.();
        }}
      />
    ),
    [handleEmailFocus, handleEmailBlur],
  );

  // Submit handler
  const onSubmit = async (input: LoginInput) => {
    try {
      const actualEmail =
        input.email.includes('***') && savedEmail ? savedEmail : input.email;

      const loginInput = {
        ...input,
        email: actualEmail,
      };

      const response = await login({
        variables: {input: loginInput},
        errorPolicy: 'all',
      });

      if (response.data?.login) {
        const loginData = response.data.login;

        // Check if this user has a saved remember me preference
        const userNavState = getUserNavigationState(loginData.user.id);

        if (userNavState?.rememberMeChoice !== undefined) {
          // User has previously made a choice, use it
          await completeAuthentication(
            loginData,
            userNavState.rememberMeChoice,
          );
        } else if (rememberMe === undefined && !pwFromKeychain) {
          // First time login, show remember me modal
          setPendingAuthResponse({
            ...loginData,
            email: actualEmail,
            password: input.password,
          });
          setShowRememberModal(true);
        } else {
          // Use existing remember me preference
          await completeAuthentication(loginData, rememberMe);
        }
      } else {
        throw new Error('Login failed: No data returned');
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
        onBackPress={canGoBack ? goBack : undefined}
        fields={[
          {
            name: 'email',
            label: 'Email address',
            component: EmailInputWrapper,
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
        onLinkPress={() => navigation.navigate('ForgotPassword')}
        submitText={isLoggingIn ? 'Logging in…' : 'Login'}
        onSubmit={form.handleSubmit(onSubmit)}
        footerText="Don't have an account?"
        footerLinkText="Sign Up"
        onFooterLinkPress={() => navigation.navigate('SignUp')}
        isLoading={isLoggingIn}
      />

      {/* Credential Management Bar */}
      {hasStoredCredentials && (
        <View style={styles.credentialBar}>
          <View style={styles.credentialInfo}>
            <Icon
              name={isAuthenticated ? 'lock-open' : 'lock'}
              size={20}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.credentialText}>
              {isAuthenticated
                ? 'Using saved credentials'
                : 'Tap to use saved credentials'}
            </Text>
          </View>

          <View style={styles.credentialActions}>
            {!isAuthenticated ? (
              <TouchableOpacity
                style={styles.authButton}
                onPress={authenticateAndFillCredentials}
                disabled={loadingCreds}
                activeOpacity={0.7}>
                <Icon
                  name="fingerprint"
                  size={20}
                  color={
                    loadingCreds
                      ? theme.colors.textSecondary
                      : theme.colors.primary
                  }
                />
                <Text
                  style={[
                    styles.authButtonText,
                    loadingCreds && styles.authButtonTextDisabled,
                  ]}>
                  {loadingCreds ? 'Authenticating...' : 'Unlock'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearCredentials}
                activeOpacity={0.7}>
                <Icon
                  name="close"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Remember Me Modal */}
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
  credentialActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  clearButton: {
    padding: 6,
  },
}));
