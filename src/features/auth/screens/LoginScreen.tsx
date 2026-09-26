import React, { useState, useEffect, useRef } from 'react';
import { errorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#utils/iconUtils';

import { AuthFormTemplate } from '#features/auth/components/AuthFormTemplate';
import { AuthWrapper } from '#features/auth/components/AuthWrapper';
import { EmailInput } from '#components/molecules/EmailInput';
import { PasswordInput } from '#components/molecules/PasswordInput';
import { getLoginValidationSchema } from '#/utils/validation/auth';
import { logValidationErrors } from '#/utils/validation/common';
import type { LoginInput } from '#/graphql/generated/schemaTypes';
import { useRememberMe } from '#features/auth/hooks/useRememberMe';
import { useAuthNavigation } from '#features/auth/hooks/useAuthNavigation';
import { useAppStore, useHasStoredCredentials } from '#store/useAppStore';
import { useBiometricBackoff } from '../hooks/useBiometricBackoff';
import { authService } from '#/services/authService';
import { CodeVerificationScreen } from '#features/auth/screens/CodeVerificationScreen';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { Telemetry } from '#/services/telemetry';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';
import { authoritativeBiometryName } from '#components/organisms/biometric/biometryLabel';
import { authTestIDs } from '#features/auth/testIDs';

// `onRefusal` hands back the code as the untyped string the server sent.
const EMAIL_NOT_VERIFIED: string = ErrorCode.AuthEmailNotVerified;

/** Module-level function to load auth info.
 *  Extracted from useEffect to avoid try-catch bailout. */
async function loadAuthInfoAsync(
  getLastBiometricEmail: () => Promise<string | null>,
  checkStoredCredentials: (email?: string | null) => Promise<boolean>,
  getBiometricInfo: () => Promise<{
    isAvailable: boolean;
    biometryType: string | null;
  }>,
  setBiometricInfo: (info: {
    isAvailable: boolean;
    biometryType: string | null;
  }) => void,
  setBiometricEmail: (email: string | null) => void,
  setShouldShowBiometricButton: (v: boolean) => void,
): Promise<void> {
  try {
    // No logged-in user on the login screen — biometric login targets the
    // most-recently-enrolled account. Credentials are scoped per account, so
    // we check that specific account rather than "anyone on this device".
    const email = await getLastBiometricEmail();
    const [hasCredentials, biometric] = await Promise.all([
      checkStoredCredentials(email ?? undefined),
      getBiometricInfo(),
    ]);

    setBiometricEmail(email);
    setBiometricInfo(biometric);
    Telemetry.trackScreen('LoginScreen', {
      has_stored_credentials: hasCredentials,
      biometric_available: biometric.isAvailable,
      biometric_type: biometric.biometryType,
    });

    const shouldShow = biometric.isAvailable && hasCredentials && !!email;
    setShouldShowBiometricButton(shouldShow);
  } catch (error) {
    errorService.reportError(error, { operation: 'loadAuthInfo' });
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to load auth info',
      { component: 'LoginScreen', operation: 'loadAuthInfo' },
    );
    setShouldShowBiometricButton(false);
  }
}

export function LoginScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { navigateToForgotPassword, navigateToSignUp } = useAuthNavigation();
  const authIsLoading = useAppStore(state => state.authIsLoading);
  const postLoginCredentials = useAppStore(state => state.postLoginCredentials);
  // The sign-in lasts until the remember-login answer is acted on: the alert
  // closes on the tap, before the enrolment behind "Remember" has finished.
  const isLoggingIn = authIsLoading || !!postLoginCredentials;
  const setPostLoginCredentials = useAppStore(
    state => state.setPostLoginCredentials,
  );
  const setNavigationState = useAppStore(state => state.setNavigationState);

  // RememberMe: on an eligible login, authService stashes the credentials and
  // keeps us on the auth screen (rather than routing to main_app). Surface the
  // modal here; on a response we save credentials (accept) or not (decline),
  // then clear the stash and enter the app.
  const finishRememberMe = () => {
    setPostLoginCredentials(null);
    setNavigationState('main_app');
  };

  const { showRememberMePrompt } = useRememberMe({
    // The password is not stored: enrolment asks the server for a device-bound
    // credential and puts that behind biometry instead.
    onAccept: async ({ email }) => {
      if ((await authService.enrolDeviceCredential(email)) === 'unsaved') {
        toastService.error(t('errors.saveLoginFailed'));
      }
      finishRememberMe();
    },
    onDecline: finishRememberMe,
  });

  // Each call pushes a new alert, and the effect re-runs whenever the prompt
  // closure changes identity, so one stash must prompt exactly once.
  const promptedFor = useRef<typeof postLoginCredentials>(null);
  useEffect(() => {
    if (!postLoginCredentials || promptedFor.current === postLoginCredentials) {
      return;
    }
    promptedFor.current = postLoginCredentials;
    showRememberMePrompt(postLoginCredentials);
  }, [postLoginCredentials, showRememberMePrompt]);

  const [biometricSlotSeenOnMount, setShouldShowBiometricButton] =
    useState(false);
  // A slot proven unusable during this session takes the affordance down
  // without a remount: the mount check cannot answer for what happened after
  // it, and every further tap on a dead slot repeats the same dead end.
  const slotStillOffered = useHasStoredCredentials() !== false;
  const shouldShowBiometricButton =
    biometricSlotSeenOnMount && slotStillOffered;
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const biometricBackoff = useBiometricBackoff();
  // The address a refused-as-unverified sign-in was for. Null until the server
  // says so; set, this screen becomes the code entry for that account.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);
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
    void loadAuthInfoAsync(
      authService.getLastBiometricEmail,
      authService.checkStoredCredentials,
      authService.getBiometricInfo,
      setBiometricInfo,
      setBiometricEmail,
      setShouldShowBiometricButton,
    );
  }, []);

  // Simple form submission - directly use login with default rememberMe=true
  const onSubmit = async (input: LoginInput) => {
    Telemetry.trackEvent('login_attempt', { method: 'email_password' });

    // `login` reports its own failures and resolves false; it does not throw.
    const signedIn = await authService.login(input, {
      // A 403 that leaves the credentials valid: the mailbox is unproven, and
      // the emailed code clears it. Sending the reader to enter that code is
      // the only action available, so the screen offers it rather than
      // leaving a toast on a form they can only re-submit.
      onRefusal: code => {
        if (code === EMAIL_NOT_VERIFIED) {
          setUnverifiedEmail(input.email);
        }
      },
    });
    if (signedIn) {
      Telemetry.trackEvent('login_success', { method: 'email_password' });
    }
  };

  // Biometric authentication handler
  const handleBiometricLogin = () => {
    if (isBiometricLoading || !biometricBackoff.canAttempt) return;

    Telemetry.trackEvent('login_attempt', {
      method: 'biometric',
      biometric_type: biometricInfo.biometryType,
    });

    void executeWithLoadingState(
      async () => {
        // Exchanges the device credential; the password is never held, so
        // there is nothing here to replay through `login`.
        if (!biometricEmail) return;
        const signedIn = await authService.signInWithDeviceCredential(
          biometricEmail,
        );

        if (signedIn) {
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
      case null:
        return 'finger-print';
      default:
        return 'finger-print';
    }
  };

  // Get biometric button text
  const getBiometricButtonText = () => {
    if (isBiometricLoading) return t('labels.authenticating');
    if (isLoggingIn) return t('auth.loggingIn');
    if (!biometricBackoff.canAttempt) {
      return t('auth.biometricRetryIn', { count: biometricBackoff.countdown });
    }

    const named = authoritativeBiometryName(biometricInfo.biometryType);
    if (named) return t('auth.useBiometryType', { type: named });

    return t('auth.useBiometric');
  };

  // Rendered in place, as SignUpScreen does: `verifyEmail` is public and needs
  // no session, and there is no signed-out verification ROUTE to navigate to.
  // `onExit` is what takes it away again — navigating to Login from here lands
  // on the route already focused and changes nothing.
  if (unverifiedEmail !== null) {
    return (
      <CodeVerificationScreen
        context="signup"
        email={unverifiedEmail}
        onExit={() => setUnverifiedEmail(null)}
      />
    );
  }

  return (
    <AuthWrapper testID={authTestIDs.loginScreen}>
      <AuthFormTemplate<LoginInput>
        title={t('auth.loginTitle')}
        subtitle={t('auth.loginSubtitle')}
        fields={[
          {
            name: 'email',
            label: t('auth.emailAddress'),
            component: EmailInput,
            props: { testID: authTestIDs.loginEmailInput },
          },
          {
            name: 'password',
            label: t('auth.password'),
            component: PasswordInput,
            props: { showToggle: true, testID: authTestIDs.loginPasswordInput },
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        focusChaining
        linkText={t('auth.forgotPassword')}
        linkTestID={authTestIDs.loginForgotPasswordLink}
        onLinkPress={() => {
          Telemetry.trackEvent('forgot_password_clicked', {
            source: 'LoginScreen',
          });
          navigateToForgotPassword();
        }}
        submitText={isLoggingIn ? t('auth.loggingIn') : t('auth.logIn')}
        submitButtonTestID={authTestIDs.loginSubmitButton}
        onSubmit={form.handleSubmit(onSubmit, logValidationErrors)}
        footerText={t('auth.noAccount')}
        footerLinkText={t('auth.signUp')}
        footerLinkTestID={authTestIDs.loginSignUpLink}
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
          <AppPressable
            style={styles.biometricButton}
            onPress={() => handleBiometricLogin()}
            disabled={
              isBiometricLoading || isLoggingIn || !biometricBackoff.canAttempt
            }
            accessibilityRole="button"
            accessibilityLabel={getBiometricButtonText()}
            accessibilityHint={t('auth.biometricLoginHint')}
            accessibilityState={{
              disabled:
                isBiometricLoading ||
                isLoggingIn ||
                !biometricBackoff.canAttempt,
              busy: isBiometricLoading,
            }}
          >
            <Icon
              name={getBiometricIcon()}
              size={24}
              tone={isBiometricLoading ? 'textTertiary' : 'primary'}
            />
            <Text
              role="bodyStrong"
              style={[
                styles.biometricText,
                (isBiometricLoading || isLoggingIn) &&
                  styles.biometricTextDisabled,
              ]}
            >
              {getBiometricButtonText()}
            </Text>
          </AppPressable>
        </View>
      )}
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
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  biometricText: {
    color: theme.colors.primary,
  },
  biometricTextDisabled: {
    color: theme.colors.textSecondary,
  },
}));
