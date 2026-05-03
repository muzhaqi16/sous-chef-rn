import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
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
import { type LoginInput } from '#/graphql/generated/schemaTypes';
import { useAuth } from '#hooks/auth/useAuth';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';
import { useAppStore } from '#store/useAppStore';
import { authService } from '#/services/authService';
import { Telemetry } from '#/services/telemetry';
import {
  executeWithLoadingState,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { Text } from '#components/atoms/Text';

/** Module-level function to load auth info.
 *  Extracted from useEffect to avoid try-catch bailout. */
async function loadAuthInfoAsync(
  checkStoredCredentials: () => Promise<boolean>,
  getBiometricInfo: () => Promise<{
    isAvailable: boolean;
    biometryType: string | null;
  }>,
  setBiometricInfo: (info: {
    isAvailable: boolean;
    biometryType: string | null;
  }) => void,
  setShouldShowBiometricButton: (v: boolean) => void,
): Promise<void> {
  try {
    const [hasCredentials, biometric] = await Promise.all([
      checkStoredCredentials(),
      getBiometricInfo(),
    ]);

    setBiometricInfo(biometric);
    Telemetry.trackScreen('LoginScreen', {
      has_stored_credentials: hasCredentials,
      biometric_available: biometric.isAvailable,
      biometric_type: biometric.biometryType,
    });

    const shouldShow = biometric.isAvailable && hasCredentials;
    setShouldShowBiometricButton(shouldShow);
  } catch (error) {
    console.error('Error loading auth info:', error);
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to load auth info',
      { component: 'LoginScreen', operation: 'loadAuthInfo' },
    );
    setShouldShowBiometricButton(false);
  }
}

export function LoginScreen(): React.JSX.Element {
  const { theme } = useUnistyles();
  const { navigateToForgotPassword, navigateToSignUp } = useAuthNavigation();
  const isLoggingIn = useAppStore(state => state.authIsLoading);
  const {
    showRememberMeModal,
    pendingCredentials,
    handleRememberMeAccept,
    handleRememberMeDecline,
  } = useAuth();

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
    loadAuthInfoAsync(
      authService.checkStoredCredentials,
      authService.getBiometricInfo,
      setBiometricInfo,
      setShouldShowBiometricButton,
    );
  }, []);

  // Simple form submission - directly use login with default rememberMe=true
  const onSubmit = (input: LoginInput) => {
    Telemetry.trackEvent('login_attempt', { method: 'email_password' });

    executeMutation(
      async () => {
        await authService.login(input);
        Telemetry.trackEvent('login_success', { method: 'email_password' });
      },
      (err: unknown) => {
        Telemetry.trackError(err instanceof Error ? err : 'Login failed', {
          component: 'LoginScreen',
          operation: 'email_password_login',
        });
        authService.handleAuthError(err, 'Login');
      },
    );
  };

  // Biometric authentication handler
  const handleBiometricLogin = () => {
    if (isBiometricLoading) return;

    Telemetry.trackEvent('login_attempt', {
      method: 'biometric',
      biometric_type: biometricInfo.biometryType,
    });

    executeWithLoadingState(
      async () => {
        const credentials = await authService.loadStoredCredentials();

        if (credentials) {
          await authService.login(
            {
              email: credentials.email,
              password: credentials.password,
            },
            { showRememberPrompt: false },
          );
          Telemetry.trackEvent('login_success', {
            method: 'biometric',
            biometric_type: biometricInfo.biometryType,
          });
        }
      },
      setIsBiometricLoading,
      (error: unknown) => {
        Telemetry.trackError(
          error instanceof Error ? error : 'Biometric authentication failed',
          {
            component: 'LoginScreen',
            operation: 'biometric_login',
            biometric_type: biometricInfo.biometryType,
          },
        );
        authService.handleAuthError(error, 'Biometric login');
      },
    );
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

      {/* Biometric Authentication Section */}
      {!!shouldShowBiometricButton && (
        <View style={styles.biometricContainer}>
          {/* Main Biometric Login Button */}
          <Pressable
            style={({ pressed }) => [
              styles.biometricButton,
              pressed && styles.pressed,
            ]}
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
              size="md"
              weight="medium"
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
    color: theme.colors.primary,
  },
  biometricTextDisabled: {
    color: theme.colors.textSecondary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
