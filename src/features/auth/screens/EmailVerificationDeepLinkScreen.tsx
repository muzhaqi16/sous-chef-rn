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
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { Text } from '#components/atoms/Text';
import { Screen } from '#components/templates/Screen';
import { toastService } from '#services/toastService';

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

  // A local runner so the try holds one plain call: the React Compiler bails out
  // when a value block sits inside a try body. The catch still covers it.
  const runVerification = async () => {
    logger.info('Attempting email verification', { userId });

    const result = await verifyEmail(token);

    const payload = result.data?.verifyEmail;
    const topLevelError = getTopLevelGraphQLError(result.error);

    // A link opened twice is a verified address, not a failure; the API reports it
    // on whichever channel the refusal arrived.
    const alreadyVerified =
      (payload &&
        'code' in payload &&
        payload.code === ErrorCode.EmailAlreadyVerified) ||
      topLevelError?.code === TopLevelErrorCode.EmailAlreadyVerified;

    if (payload?.__typename === 'VerifyEmailPayload' || alreadyVerified) {
      logger.info('Email verification successful', { alreadyVerified });

      // A patch: the store's updateUser assigns these onto the existing user, and
      // re-assigning every field republishes an identical object each call.
      updateUser({ emailVerified: true });

      setVerificationResult('success');

      toastService.success(tGlobal('auth.emailVerifiedToast'));
    } else {
      // A throttled request says how long to wait; the server's raw text is not a
      // user message.
      if (isRateLimitError(result.error)) {
        throw new Error(getRateLimitMessage(result.error));
      }
      // Auth failures arrive as top-level GraphQL errors, not an AuthError variant.
      if (topLevelError) {
        throw new Error(
          errorService.getUserFriendlyMessage(
            topLevelError.code,
            topLevelError.message,
          ),
        );
      }
      const message = payload && 'message' in payload ? payload.message : null;
      throw new Error(message ?? tGlobal('errors.verificationFailed'));
    }
  };

  try {
    await runVerification();
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Email verification failed', { error });

    const errorMsg = err.message || tGlobal('auth.verificationFailedExpired');
    setErrorMessage(errorMsg);
    setVerificationResult('error');

    toastService.error(errorMsg);
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

  const performVerification = () => {
    performVerificationImpl({
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

    performVerificationImpl({
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
                  testID="email-verified-sign-in"
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
                testID="verification-retry"
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
