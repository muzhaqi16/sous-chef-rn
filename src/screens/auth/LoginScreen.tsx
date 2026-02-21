import React, { useState, useEffect } from 'react';
import { View, Pressable, Text, ActivityIndicator } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

import { AuthFormTemplate } from '#components/templates/AuthFormTemplate';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { EmailInput } from '#components/atoms/EmailInput';
import { PasswordInput } from '#components/atoms/PasswordInput';
import { RememberMeModal } from '#components/organisms/RememberMeModal';
import { getLoginValidationSchema } from '#/utils/validation/auth';
import { type LoginInput } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';
import { Telemetry } from '#/services/telemetry';

export function LoginScreen() {
  const { theme } = useUnistyles();
  const { navigateToForgotPassword, navigateToSignUp } = useAuthNavigation();
  const {
    login,
    handleAuthError,
    isLoading: isLoggingIn,
    loadStoredCredentials,
    checkStoredCredentials,
    getBiometricInfo,
    showRememberMeModal,
    pendingCredentials,
    handleRememberMeAccept,
    handleRememberMeDecline,
  } = useAuth();

  const [_hasStoredCreds, setHasStoredCreds] = useState(false);
  const [shouldShowBiometricButton, setShouldShowBiometricButton] =
    useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState<{
    isAvailable: boolean;
    biometryType: string | null;
  }>({ isAvailable: false, biometryType: null });

  const form = useForm<LoginInput>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: { email: '', password: '' },
  });

  // Track screen view and load stored credentials and biometric info on mount
  useEffect(() => {
    const loadAuthInfo = async () => {
      try {
        const [hasCredentials, biometric] = await Promise.all([
          checkStoredCredentials(),
          getBiometricInfo(),
        ]);

        setBiometricInfo(biometric);
        setHasStoredCreds(hasCredentials);

        // Track screen view after loading auth info
        Telemetry.trackScreen('LoginScreen', {
          has_stored_credentials: hasCredentials,
          biometric_available: biometric.isAvailable,
          biometric_type: biometric.biometryType,
        });

        // Only show biometric button if:
        // 1. Biometric is available on device
        // 2. User has stored credentials (meaning they've previously enabled biometric)
        const shouldShow = biometric.isAvailable && hasCredentials;
        setShouldShowBiometricButton(shouldShow);
      } catch (error) {
        console.error('Error loading auth info:', error);
        Telemetry.trackError(
          error instanceof Error ? error : 'Failed to load auth info',
          { component: 'LoginScreen', operation: 'loadAuthInfo' },
        );
        setHasStoredCreds(false);
        setShouldShowBiometricButton(false);
      }
    };

    loadAuthInfo();
  }, [checkStoredCredentials, getBiometricInfo]);

  // Simple form submission - directly use login with default rememberMe=true
  const onSubmit = async (input: LoginInput) => {
    Telemetry.trackEvent('login_attempt', { method: 'email_password' });

    try {
      await login(input); // Uses default rememberMe=true
      Telemetry.trackEvent('login_success', { method: 'email_password' });
    } catch (err: any) {
      Telemetry.trackError(err instanceof Error ? err : 'Login failed', {
        component: 'LoginScreen',
        operation: 'email_password_login',
      });
      handleAuthError(err, 'Login failed. Please try again.');
    }
  };

  // Biometric authentication handler
  const handleBiometricLogin = async () => {
    if (isBiometricLoading) return;

    Telemetry.trackEvent('login_attempt', {
      method: 'biometric',
      biometric_type: biometricInfo.biometryType,
    });

    try {
      setIsBiometricLoading(true);
      const credentials = await loadStoredCredentials();

      if (credentials) {
        // Use showRememberPrompt = false for biometric login since credentials are already saved
        await login(
          {
            email: credentials.email,
            password: credentials.password,
          },
          false,
        );
        Telemetry.trackEvent('login_success', {
          method: 'biometric',
          biometric_type: biometricInfo.biometryType,
        });
      }
    } catch (error: any) {
      Telemetry.trackError(
        error instanceof Error ? error : 'Biometric authentication failed',
        {
          component: 'LoginScreen',
          operation: 'biometric_login',
          biometric_type: biometricInfo.biometryType,
        },
      );
      handleAuthError(error, 'Biometric authentication failed');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  // Get appropriate biometric icon
  const getBiometricIcon = () => {
    if (!biometricInfo.isAvailable) return 'finger-print';

    switch (biometricInfo.biometryType) {
      case 'Face ID':
        return 'scan-outline';
      case 'Touch ID':
      case 'Fingerprint':
        return 'finger-print';
      default:
        return 'finger-print';
    }
  };

  // Get biometric button text
  const getBiometricButtonText = () => {
    if (isBiometricLoading) return 'Authenticating...';
    if (isLoggingIn) return 'Logging in...';

    if (biometricInfo.biometryType) {
      return `Use ${biometricInfo.biometryType}`;
    }

    return 'Use Biometric Login';
  };

  return (
    <AuthWrapper testID="login-screen">
      <AuthFormTemplate<LoginInput>
        title="Sign in to Sous Chef"
        subtitle="Access your pantry and more"
        fields={[
          {
            name: 'email',
            label: 'Email address',
            component: EmailInput,
            props: { testID: 'login-email-input' },
          },
          {
            name: 'password',
            label: 'Password',
            component: PasswordInput,
            props: { showToggle: true, testID: 'login-password-input' },
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        linkText="Forgot password?"
        linkTestID="login-forgot-password-link"
        onLinkPress={() => {
          Telemetry.trackEvent('forgot_password_clicked', {
            source: 'LoginScreen',
          });
          navigateToForgotPassword();
        }}
        submitText={isLoggingIn ? 'Logging in…' : 'Log In'}
        submitButtonTestID="login-submit-button"
        onSubmit={form.handleSubmit(onSubmit)}
        footerText="Don't have an account?"
        footerLinkText="Sign Up"
        footerLinkTestID="login-signup-link"
        onFooterLinkPress={() => {
          Telemetry.trackEvent('signup_navigation_clicked', {
            source: 'LoginScreen',
          });
          navigateToSignUp();
        }}
        isLoading={isLoggingIn}
      />

      {/* Loading indicator */}
      {(isLoggingIn || isBiometricLoading) && (
        <ActivityIndicator testID="login-loading" size="small" />
      )}

      {/* Biometric Authentication Section */}
      {shouldShowBiometricButton && (
        <View style={styles.biometricContainer}>
          {/* Main Biometric Login Button */}
          <Pressable
            style={({pressed}) => [styles.biometricButton, pressed && styles.pressed]}
            onPress={() => handleBiometricLogin()}
            disabled={isBiometricLoading || isLoggingIn}
            accessibilityRole="button"
            accessibilityLabel={getBiometricButtonText()}
            accessibilityHint="Log in using biometric authentication"
            accessibilityState={{
              disabled: isBiometricLoading || isLoggingIn,
              busy: isBiometricLoading,
            }}
          >
            <Icon
              name={getBiometricIcon()}
              size={24}
              color={
                isBiometricLoading
                  ? theme.colors.textTertiary
                  : theme.colors.primary
              }
            />
            <Text
              style={[
                styles.biometricText,
                (isBiometricLoading || isLoggingIn) &&
                  styles.biometricTextDisabled,
              ]}
            >
              {getBiometricButtonText()}
            </Text>
          </Pressable>
        </View>
      )}

      {/* RememberMe Modal */}
      <RememberMeModal
        visible={showRememberMeModal}
        onAccept={handleRememberMeAccept}
        onDecline={handleRememberMeDecline}
        email={pendingCredentials?.email || ''}
      />
    </AuthWrapper>
  );
}

const styles = StyleSheet.create(theme => ({
  biometricContainer: {
    marginVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  biometricText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  biometricTextDisabled: {
    color: theme.colors.textSecondary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
