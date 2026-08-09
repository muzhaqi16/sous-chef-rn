import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button } from '#/components/base/Button';
import { t as tGlobal } from '#/i18n/t';
import { useRoute } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Header } from '#components/molecules/Header';
import { useUpdateUser, useUser } from '#store/useAppStore';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMutation } from '@apollo/client/react';
import {
  VerifyEmailDocument,
  type VerifyEmailMutation,
  type VerifyEmailMutationVariables,
} from '#operations/auth/auth.generated';
import { logger } from '#/utils/environment';
import { useToast } from '#/hooks/useToast';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { TopLevelErrorCode } from '#/utils/errors/topLevelErrorCodes';
import { errorService } from '#/services/errorService';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { Text } from '#components/atoms/Text';

interface EmailVerificationRouteParams {
  token: string;
}

/** Long enough for the success state to register before the screen changes. */
const HANDOFF_DELAY_MS = 1500;

interface VerificationRun {
  token: string | undefined;
  verifyEmail: useMutation.MutationFunction<
    VerifyEmailMutation,
    VerifyEmailMutationVariables
  >;
  userId: string | undefined;
  updateUser: (updates: Partial<{ emailVerified: boolean }>) => void;
  toast: ReturnType<typeof useToast>;
  setVerificationResult: (v: 'success' | 'error' | null) => void;
  setErrorMessage: (v: string) => void;
  /** Whichever busy flag drives the progress indicator for this run. */
  setBusy: (v: boolean) => void;
  /**
   * A retry leaves the failed state on screen and shows progress in the button
   * alone. Clearing it would swap the whole screen back to the full-page
   * "Verifying…" state, which reads as if the failure never happened.
   */
  isRetry: boolean;
}

/** Module-level try-catch extraction for React Compiler compatibility */
async function performVerificationImpl({
  token,
  verifyEmail,
  userId,
  updateUser,
  toast,
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

  await executeMutation(
    async () => {
      logger.info('Attempting email verification', { userId });

      const result = await verifyEmail({
        variables: { input: { code: token } },
      });

      const payload = result.data?.verifyEmail;
      const topLevelError = getTopLevelGraphQLError(result.error);

      // A link opened twice — from the mail app and then from the browser, or
      // simply tapped again — is a verified address, not a failure. The API
      // reports it on whichever channel the refusal came from.
      const alreadyVerified =
        (payload &&
          'code' in payload &&
          payload.code === ErrorCode.EmailAlreadyVerified) ||
        topLevelError?.code === TopLevelErrorCode.EmailAlreadyVerified;

      if (payload?.__typename === 'VerifyEmailPayload' || alreadyVerified) {
        logger.info('Email verification successful', { alreadyVerified });

        // A patch, not a spread of the whole user: the store's updateUser
        // assigns the given fields onto the existing user, and re-assigning
        // every field would republish an identical object on each call.
        updateUser({ emailVerified: true });

        setVerificationResult('success');

        toast({
          message: tGlobal('auth.emailVerifiedToast'),
          type: 'success',
        });
      } else {
        // A throttled request says how long to wait; the server's raw
        // "Maximum 10 requests per 3600 seconds" text is not a user message.
        if (isRateLimitError(result.error)) {
          throw new Error(getRateLimitMessage(result.error));
        }
        // Auth failures now arrive as top-level GraphQL errors, not an
        // AuthError union variant.
        if (topLevelError) {
          throw new Error(
            errorService.getUserFriendlyMessage(
              topLevelError.code,
              topLevelError.message,
            ),
          );
        }
        const message =
          payload && 'message' in payload ? payload.message : null;
        throw new Error(message ?? tGlobal('errors.verificationFailed'));
      }
      return result;
    },
    (error: unknown) => {
      const err = error as Error;
      logger.error('Email verification failed', { error });

      const errorMsg = err.message || tGlobal('auth.verificationFailedExpired');
      setErrorMessage(errorMsg);
      setVerificationResult('error');

      toast({
        message: errorMsg,
        type: 'error',
      });
    },
  );

  setBusy(false);
}

export const EmailVerificationDeepLinkScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute();
  // `goBack` from the facade is guarded — the raw one logs "GO_BACK was not
  // handled by any navigator" when this screen is the only route, which is the
  // normal shape for a cold start straight into a link.
  const { goBack: dismiss } = useAppNavigation();
  const { navigateToLogin, replaceWithLogin } = useAuthNavigation();
  const user = useUser();
  const updateUser = useUpdateUser();
  const toast = useToast();

  const { token } = (route.params ??
    {}) as Partial<EmailVerificationRouteParams>;

  const [verifyEmail] = useMutation(VerifyEmailDocument);
  const [isVerifying, setIsVerifying] = useState(true);
  // Kept apart from `isVerifying` so a retry spins the button instead of
  // replacing the failure the user is looking at with the full-page loader.
  const [isRetrying, setIsRetrying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<
    'success' | 'error' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // The token is single-use and `verifyEmail` is rate-limited to 10 requests an
  // hour, so it has to be spent exactly once. Without this latch the effect
  // re-fired on every identity change among its dependencies — including the
  // one it caused itself, since a successful verification writes `emailVerified`
  // back to the store — and burned through the whole hourly budget while the
  // screen sat on "Verifying…". Recording which token was sent, rather than a
  // bare "has run" flag, still lets a genuinely different token through if the
  // screen is reused for a second link.
  const sentTokenRef = useRef<string | null>(null);
  const userId = user?.id;

  // `verifyEmail` returns the user but no tokens, so a link followed from the
  // registration mail activates the account without opening a session — signing
  // in is the next step. A user who already had a session (verification
  // deferred, link opened later) is moved along by the root navigator
  // re-deriving its target from `emailVerified`; this screen sits in the
  // always-mounted deep-link group, so it has to step aside to reveal that.
  //
  // Both branches REMOVE this screen rather than navigate over it. The deep-link
  // group has no `if`, so this screen outlives the `Auth` group that signing in
  // takes away: left on the stack it resurfaces, still showing "Email Verified!",
  // as the top route right after login — with nothing beneath it to go back to.
  const handleVerified = () => {
    if (!userId) {
      replaceWithLogin();
      return;
    }
    dismiss();
  };

  const performVerification = () => {
    performVerificationImpl({
      token,
      verifyEmail,
      userId,
      updateUser,
      toast,
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
      toast,
      setVerificationResult,
      setErrorMessage,
      setBusy: setIsVerifying,
      isRetry: false,
    });
  }, [token, verifyEmail, userId, updateUser, toast]);

  // Held briefly so the success state registers before the screen changes.
  // Unlike the verification itself this is safe to re-schedule — the cleanup
  // cancels the pending hand-off, including on an unmount from the close
  // button, so a user who dismisses the screen isn't navigated a second later.
  useEffect(() => {
    if (verificationResult !== 'success') return;
    const id = setTimeout(handleVerified, HANDOFF_DELAY_MS);
    return () => clearTimeout(id);
  }, [verificationResult, handleVerified]);

  return (
    <View style={styles.container}>
      <Header onClose={dismiss} />
      <View style={styles.content}>
        {!!isVerifying && (
          <>
            <SousChefLoader
              size="small"
              showBrand={false}
              message={t('auth.verifyingEmail')}
            />
            <Text
              size="md"
              tone="secondary"
              align="center"
              lineHeight="relaxed"
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
            <Text
              size="xl"
              weight="semibold"
              align="center"
              style={styles.title}
            >
              {t('auth.emailVerifiedTitle')}
            </Text>
            <Text
              size="md"
              tone="secondary"
              align="center"
              lineHeight="relaxed"
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
            <Text
              size="xl"
              weight="semibold"
              align="center"
              style={styles.title}
            >
              {t('auth.verificationFailedTitle')}
            </Text>
            <Text
              size="md"
              tone="secondary"
              align="center"
              lineHeight="relaxed"
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
    </View>
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
    marginTop: theme.spacing['3'],
  },
  actions: {
    marginTop: theme.spacing.xl,
    width: '100%',
  },
}));
