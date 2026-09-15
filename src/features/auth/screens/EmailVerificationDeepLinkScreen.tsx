import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Button } from '#components/molecules/Button';
import { t as tGlobal } from '#/i18n';
import { useRoute } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { useUpdateUser, useUser } from '#store/useAppStore';
import { useAuthNavigation } from '#features/auth/hooks/useAuthNavigation';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useVerifyEmail,
  type VerifyEmailFn,
} from '#features/auth/hooks/useVerifyEmail';
import { logger } from '#/utils/environment';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { Text } from '#components/atoms/Text';
import { Screen } from '#components/templates/Screen';
import { toastService } from '#services/toastService';
import { authTestIDs } from '#features/auth/testIDs';

interface EmailVerificationRouteParams {
  token: string;
}

/** Long enough for the success state to register before the screen changes. */
const HANDOFF_DELAY_MS = 1500;

interface VerificationRun {
  token: string | undefined;
  verifyEmail: VerifyEmailFn;
  userId: string | undefined;
  updateUser: (updates: Partial<{ emailVerified: boolean }>) => void;
  setVerificationResult: (v: 'success' | 'error' | null) => void;
  setErrorMessage: (v: string) => void;
  /** Whichever busy flag drives the progress indicator for this run. */
  setBusy: (v: boolean) => void;
  /** A retry keeps the failed state on screen and spins the button alone; clearing
   *  it swaps back to the full-page loader, reading as if nothing had failed. */
  isRetry: boolean;
}

async function performVerificationImpl({
  token,
  verifyEmail,
  userId,
  updateUser,
  setVerificationResult,
  setErrorMessage,
  setBusy,
  isRetry,
}: VerificationRun): Promise<void> {
  if (!token) {
    setVerificationResult('error');
    setErrorMessage(tGlobal('auth.invalidVerificationToken'));
    setBusy(false);
    return;
  }

  setBusy(true);
  if (!isRetry) {
    setVerificationResult(null);
    setErrorMessage('');
  }

  logger.info('Attempting email verification', { userId });

  // A link opened twice is a verified address, not a failure. A refused link is
  // spent or unknown, and the copy says so — never the server's own text.
  const outcome = await verifyEmail(
    token,
    undefined,
    tGlobal('auth.verificationFailedExpired'),
  );

  if (outcome.status === 'verified') {
    logger.info('Email verification successful');

    // A patch: the store's updateUser assigns these onto the existing user, and
    // re-assigning every field republishes an identical object each call.
    updateUser({ emailVerified: true });

    setVerificationResult('success');

    toastService.success(tGlobal('auth.emailVerifiedToast'));
  } else {
    logger.error('Email verification failed', { status: outcome.status });
    setErrorMessage(outcome.body);
    setVerificationResult('error');

    toastService.error(outcome.body);
  }

  setBusy(false);
}

export const EmailVerificationDeepLinkScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute();
  // The facade's `goBack` is guarded; the raw one logs "GO_BACK was not handled"
  // when this screen is the only route, the normal shape for a cold link start.
  const { goBack: dismiss } = useAppNavigation();
  const { navigateToLogin, replaceWithLogin } = useAuthNavigation();
  const user = useUser();
  const updateUser = useUpdateUser();

  const { token } = (route.params ??
    {}) as Partial<EmailVerificationRouteParams>;

  const { verifyEmail } = useVerifyEmail();
  const [isVerifying, setIsVerifying] = useState(true);
  // Apart from `isVerifying` so a retry spins the button instead of replacing the
  // failure with the full-page loader.
  const [isRetrying, setIsRetrying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<
    'success' | 'error' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // The token is single-use and `verifyEmail` allows 10 requests an hour, so it
  // must be spent exactly once — without this latch the effect re-fires on every
  // dependency identity change, including the one it causes itself by writing
  // `emailVerified` back. Recording WHICH token was sent, not a bare "has run"
  // flag, still lets a genuinely different token through.
  const sentTokenRef = useRef<string | null>(null);
  const userId = user?.id;

  // `verifyEmail` settles a refusal as an outcome, so the run never rejects.
  const performVerification = () => {
    void performVerificationImpl({
      token,
      verifyEmail,
      userId,
      updateUser,
      setVerificationResult,
      setErrorMessage,
      setBusy: setIsRetrying,
      isRetry: true,
    });
  };

  useEffect(() => {
    const requestedToken = token ?? '';
    if (sentTokenRef.current === requestedToken) return;
    sentTokenRef.current = requestedToken;

    void performVerificationImpl({
      token,
      verifyEmail,
      userId,
      updateUser,
      setVerificationResult,
      setErrorMessage,
      setBusy: setIsVerifying,
      isRetry: false,
    });
  }, [token, verifyEmail, userId, updateUser]);

  // Held briefly so the success state registers; the cleanup cancels the pending
  // hand-off, so dismissing the screen doesn't navigate a second later.

  // `verifyEmail` returns the user but no tokens, so a link from the registration
  // mail activates the account with no session and signing in is next; a user who
  // already had one is moved along by the root navigator re-deriving its target.

  // Both branches REMOVE this screen rather than navigate over it. The deep-link
  // group has no `if`, so left on the stack it outlives the `Auth` group and
  // resurfaces as the top route after login, with nothing beneath it.
  useEffect(() => {
    if (verificationResult !== 'success') return;
    const id = setTimeout(() => {
      if (!userId) {
        replaceWithLogin();
        return;
      }
      dismiss();
    }, HANDOFF_DELAY_MS);
    return () => clearTimeout(id);
  }, [verificationResult, userId, replaceWithLogin, dismiss]);

  return (
    <Screen header={{ close: dismiss }} scroll="list" gutter="none">
      <View style={styles.content}>
        {!!isVerifying && (
          <>
            <SousChefLoader
              size="small"
              showBrand={false}
              message={t('auth.verifyingEmail')}
            />
            <Text
              role="body"
              tone="secondary"
              align="center"
              style={styles.subtitle}
            >
              {t('auth.verifyingEmailSubtitle')}
            </Text>
          </>
        )}

        {verificationResult === 'success' && (
          <>
            <View style={styles.iconContainer}>
              <Icon name="checkmark-circle" size={64} tone="success" />
            </View>
            <Text role="subheading" align="center" style={styles.title}>
              {t('auth.emailVerifiedTitle')}
            </Text>
            <Text
              role="body"
              tone="secondary"
              align="center"
              style={styles.subtitle}
            >
              {t('auth.emailVerifiedDescription')}
              {/* Verification opens no session, so a link followed from the
                  registration mail has no user to describe the next step for —
                  that account signs in from here. */}
              {!userId
                ? t('auth.emailVerifiedSignIn')
                : user?.onBoarded
                ? t('auth.emailVerifiedCanAccess')
                : t('auth.emailVerifiedCompleteSetup')}
            </Text>

            {!userId && (
              <View style={styles.actions}>
                <Button
                  title={t('auth.signIn')}
                  onPress={navigateToLogin}
                  testID={authTestIDs.emailVerifiedSignInButton}
                />
              </View>
            )}
          </>
        )}

        {verificationResult === 'error' && (
          <>
            <View style={styles.iconContainer}>
              <Icon name="close-circle-outline" size={64} tone="error" />
            </View>
            <Text role="subheading" align="center" style={styles.title}>
              {t('auth.verificationFailedTitle')}
            </Text>
            <Text
              role="body"
              tone="secondary"
              align="center"
              style={styles.subtitle}
            >
              {errorMessage}
            </Text>

            <View style={styles.actions}>
              <Button
                title={t('auth.tryAgain')}
                onPress={performVerification}
                loading={isRetrying}
                testID={authTestIDs.emailVerificationRetryButton}
              />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    marginTop: theme.spacing.md,
  },
  subtitle: {
    marginTop: theme.spacing.base,
  },
  actions: {
    marginTop: theme.spacing.xl,
    width: '100%',
  },
}));
