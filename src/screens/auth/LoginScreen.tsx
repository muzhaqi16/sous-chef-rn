import React, { useEffect, useState, useCallback } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Icon } from '#utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AuthFormTemplate, AuthWrapper } from '#components/templates';
import { EmailInput, PasswordInput } from '#components/atoms';
import { getLoginValidationSchema } from '#/utils';
import { useStore } from '#store';
import { type LoginInput } from '#generated';
import { useAuth, useAuthNavigation } from '#hooks';
import { useAuthFlowContext } from '#/components/providers/AuthFlowProvider';
import { getEmailOnly } from '#/storage/keychain';

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
  const { theme } = useUnistyles();
  const { hasStoredCredentials } = useStore();

  const [savedEmail, setSavedEmail] = useState<string>('');
  const [userHasTypedManually, setUserHasTypedManually] = useState(false);

  const { navigateToForgotPassword, navigateToSignUp } = useAuthNavigation();
  const { loginFlow } = useAuthFlowContext();
  const {
    loadStoredCredentials,
    isLoadingCredentials,
    handleAuthError,
    login,
    isLoading: isLoggingIn,
  } = useAuth();


  const form = useForm<LoginInput>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: { email: '', password: '' },
  });

  // Load saved email only when user explicitly requests biometric auth
  // Removed automatic loading to prevent unwanted biometric prompts

  // Detect manual typing to disable biometric authentication
  useEffect(() => {
    const subscription = form.watch(data => {
      // If user changes email field from the obscured version, they're typing manually
      if (
        data.email &&
        savedEmail &&
        !data.email.includes('***') &&
        data.email !== obscureEmail(savedEmail)
      ) {
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

      // Load and display email for user confirmation before login
      try {
        const email = await getEmailOnly();
        if (email) {
          setSavedEmail(email);
          form.setValue('email', obscureEmail(email));
        }
      } catch (emailError) {
        // If email loading fails, continue with login using credentials
        console.warn('Could not load saved email:', emailError);
      }

      // Use the consolidated login function for biometric login
      await login(
        {
          email: credentials.email,
          password: credentials.password,
        },
        true,
      ); // rememberMe = true for biometric login
    } catch (error: any) {
      handleAuthError(error, 'Biometric authentication failed');
    }
  }, [
    loadStoredCredentials,
    login,
    handleAuthError,
    isLoadingCredentials,
    userHasTypedManually,
    form,
  ]);


  // Form submission
  const onSubmit = async (input: LoginInput) => {
    try {
      // Determine if this is truly manual input (not using saved credentials)
      const isUsingObscuredEmail = input.email.includes('***');
      const actualEmail =
        isUsingObscuredEmail && savedEmail ? savedEmail : input.email;

      // Use centralized auth flow - handles auth + remember me modal automatically
      await loginFlow({ ...input, email: actualEmail });
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
            props: { showToggle: true },
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
            disabled={isLoadingCredentials}
          >
            <Icon
              name="fingerprint"
              size={26}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      )}
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
