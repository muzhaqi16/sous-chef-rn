import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';

import { AuthFormTemplate, AuthWrapper } from '#components/templates';
import { EmailInput, PasswordInput } from '#components/atoms';
import { getLoginValidationSchema } from '#/utils';
import { type LoginInput } from '#generated';
import { useAuth, useAuthNavigation } from '#hooks';

export function LoginScreen() {
  const { navigateToForgotPassword, navigateToSignUp } = useAuthNavigation();
  const {
    login,
    handleAuthError,
    isLoading: isLoggingIn,
    checkStoredCredentials,
    loadStoredCredentials
  } = useAuth();

  const [hasStoredCreds, setHasStoredCreds] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  // Check for stored credentials on mount
  useEffect(() => {
    const checkCreds = async () => {
      try {
        const hasCredentials = await checkStoredCredentials();
        setHasStoredCreds(hasCredentials);
      } catch (error) {
        console.error('Error checking stored credentials:', error);
        setHasStoredCreds(false);
      }
    };

    checkCreds();
  }, [checkStoredCredentials]);

  const form = useForm<LoginInput>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: { email: '', password: '' },
  });

  // Simple form submission - directly use login with default rememberMe=true
  const onSubmit = async (input: LoginInput) => {
    try {
      await login(input); // Uses default rememberMe=true
    } catch (err: any) {
      handleAuthError(err, 'Login failed. Please try again.');
    }
  };

  // Biometric authentication handler
  const handleBiometricLogin = async () => {
    if (isBiometricLoading) return;

    try {
      setIsBiometricLoading(true);
      const credentials = await loadStoredCredentials();

      if (credentials) {
        await login({
          email: credentials.email,
          password: credentials.password
        });
      }
    } catch (error: any) {
      handleAuthError(error, 'Biometric authentication failed');
    } finally {
      setIsBiometricLoading(false);
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

      {/* Biometric Authentication Button */}
      {hasStoredCreds && (
        <View style={styles.biometricContainer}>
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricLogin}
            disabled={isBiometricLoading || isLoggingIn}
          >
            <Icon
              name="fingerprint"
              size={24}
              color={isBiometricLoading ? '#999' : '#007AFF'}
            />
            <Text style={[
              styles.biometricText,
              (isBiometricLoading || isLoggingIn) && styles.biometricTextDisabled
            ]}>
              {isBiometricLoading ? 'Authenticating...' : 'Use Biometric Login'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </AuthWrapper>
  );
}

const styles = StyleSheet.create(theme => ({
  biometricContainer: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  biometricText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  biometricTextDisabled: {
    color: theme.colors.textSecondary,
  },
}));
