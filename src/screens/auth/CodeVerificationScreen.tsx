import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { t as tGlobal } from '#/i18n/t';
import { GraphQLError } from 'graphql';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { AuthFormTemplate } from '#components/templates/AuthFormTemplate';
import { CodeInputAdapter } from '#components/molecules/CodeInputAdapter';
import { useUpdateUser, useUser } from '#store/useAppStore';
import { useToast } from '#/hooks/useToast';
import { useMutation } from '@apollo/client/react';
import {
  VerifyEmailDocument,
  ResendVerificationEmailDocument,
  type VerifyEmailMutation,
  type VerifyEmailMutationVariables,
} from '#operations/auth/auth.generated';
import { errorService } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { useEmailVerificationActions } from '#hooks/auth/useEmailVerification';
import { logger } from '#/utils/environment';
import { logValidationErrors } from '#/utils/validation/common';
import { getEmailVerificationValidationSchema } from '#/utils/validation/auth';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import type { ToastFn } from '#/components/atoms/Toast';
import { SousChefLoader } from '#/components/base/SousChefLoader';

export function extractVerificationToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes('verify-email')) return null;
    const token = parsed.searchParams.get('token');
    if (!token || !/^[0-9a-fA-F]{32}$/.test(token)) return null;
    return token;
  } catch {
    return null;
  }
}

/** Module-level async function to handle deep link auto-verification.
 *  Extracted from component body to avoid try-catch bailout. */
type VerifyEmailFn = useMutation.MutationFunction<
  VerifyEmailMutation,
  VerifyEmailMutationVariables
>;

async function performAutoVerify(
  token: string,
  verifyEmail: VerifyEmailFn,
  updateUser: (patch: { emailVerified: boolean }) => void,
  toast: ToastFn,
  setIsAutoVerifying: (v: boolean) => void,
  autoVerifyProcessedRef: React.RefObject<boolean>,
): Promise<void> {
  try {
    logger.info('Auto-verifying email from deep link', {
      tokenPrefix: token.substring(0, 8) + '...',
    });

    const result = await verifyEmail({ variables: { input: { code: token } } });

    const payload = result.data?.verifyEmail;
    if (payload?.__typename === 'VerifyEmailPayload') {
      updateUser({ emailVerified: true });
      toast({ message: tGlobal('auth.emailVerifiedToast'), type: 'success' });
    } else {
      const message =
        payload && 'message' in payload ? payload.message : undefined;
      throw new Error(message || tGlobal('errors.verificationFailed'));
    }
  } catch (error: unknown) {
    logger.error('Auto-verify failed', { error });
    const errorMsg =
      (error instanceof Error ? error.message : undefined) ||
      tGlobal('auth.verificationFailedExpired');
    toast({ message: errorMsg, type: 'error' });
    setIsAutoVerifying(false);
    autoVerifyProcessedRef.current = false;
  }
}

// Exponential backoff delays in seconds: immediate, then 30s, 1m, 3m, 5m
const RESEND_BACKOFF_DELAYS = [0, 30, 60, 180, 300];

const getBackoffDelay = (attemptCount: number): number => {
  const index = Math.min(attemptCount, RESEND_BACKOFF_DELAYS.length - 1);
  return RESEND_BACKOFF_DELAYS[index];
};

type CodeVerificationValues = {
  code: string;
};

export function CodeVerificationScreen(): React.JSX.Element | null {
  const { t } = useTranslation();
  const user = useUser();
  const updateUser = useUpdateUser();
  const toast = useToast();
  const { skipVerification } = useEmailVerificationActions();
  const [verifyEmail] = useMutation(VerifyEmailDocument);
  const [resendVerificationEmail] = useMutation(
    ResendVerificationEmailDocument,
  );

  // Auto-verify state for deep link handling
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);
  const autoVerifyProcessedRef = useRef(false);

  // Backoff state for resend rate limiting
  const [resendAttempts, setResendAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(getEmailVerificationValidationSchema()),
    defaultValues: { code: '' },
  });

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Listen for deep link URLs (cold start + warm start)
  useEffect(() => {
    const handleUrl = (url: string) => {
      const token = extractVerificationToken(url);
      if (token) {
        // Inline autoVerify logic to avoid dependency on function that changes every render
        if (autoVerifyProcessedRef.current) return;
        autoVerifyProcessedRef.current = true;
        setIsAutoVerifying(true);

        performAutoVerify(
          token,
          verifyEmail,
          updateUser,
          toast,
          setIsAutoVerifying,
          autoVerifyProcessedRef,
        );
      }
    };

    // Cold start: app was killed, opened via deep link
    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });

    // Warm start: app in background, opened via deep link
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, [verifyEmail, updateUser, toast]);

  // No navigation effects needed - conditional groups handle it
  useEffect(() => {
    // If user is already verified, the conditional navigation
    // will automatically move them to the next appropriate screen
    if (user?.emailVerified) {
      logger.debug('User email verified, navigation will update automatically');
    }
  }, [user?.emailVerified]);

  // Start countdown timer for backoff
  const startCountdown = (seconds: number) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    setCountdown(seconds);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onVerifyCode = (data: CodeVerificationValues) => {
    executeMutation(
      async () => {
        const response = await verifyEmail({
          variables: { input: { code: data.code } },
        });

        const payload = response.data?.verifyEmail;
        if (payload?.__typename === 'VerifyEmailPayload') {
          updateUser({ emailVerified: true });
          return;
        }
        // Auth failures now arrive as top-level GraphQL errors, not an
        // AuthError union variant.
        const topLevelError = getTopLevelGraphQLError(response.error);
        if (topLevelError) {
          toast({
            message: errorService.getUserFriendlyMessage(
              topLevelError.code,
              topLevelError.message,
            ),
            type: 'error',
          });
        } else if (payload) {
          const message =
            'message' in payload
              ? payload.message
              : t('errors.verificationFailed');
          toast({ message, type: 'error' });
        }
      },
      error => {
        errorService.reportError(error, {
          operation: 'CodeVerification.verifyEmail',
        });
        toast({
          message: t('errors.somethingWentWrong'),
          type: 'error',
        });
      },
    );
  };

  // The only way off this screen without a working code. `verification` is a
  // conditional group holding one headerless screen, and RootNavigator re-derives
  // that target from `user` on every change — so nothing but clearing the user
  // can move them. Logout is entirely local (LogoutCleanup cancels timers and
  // subscriptions; device deregistration is fire-and-forget), so this still works
  // when the mail server, or the whole API, is down.
  const onBackToLogin = () => {
    alertService.alert(
      t('auth.exitVerificationTitle'),
      t('auth.exitVerificationMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('auth.exitVerificationConfirm'),
          style: 'destructive',
          onPress: () => {
            authService.logout();
          },
        },
      ],
    );
  };

  // Deferring is a real choice, not a dismissal, so it states the cost up front
  // — sharing and collaborating stay unavailable until the address is verified.
  const onSkip = () => {
    alertService.alert(
      t('auth.skipVerificationTitle'),
      t('auth.skipVerificationMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        { text: t('auth.skipVerification'), onPress: skipVerification },
      ],
    );
  };

  const onResend = () => {
    // Prevent resend during countdown
    if (countdown > 0 || !user?.email) return;

    executeMutation(
      async () => {
        const response = await resendVerificationEmail({
          variables: { input: { email: user.email } },
        });

        // Increment attempts and start countdown for next request
        const newAttempts = resendAttempts + 1;
        setResendAttempts(newAttempts);
        const nextDelay = getBackoffDelay(newAttempts);
        if (nextDelay > 0) {
          startCountdown(nextDelay);
        }

        // Check for errors in response (errorPolicy: 'all' returns errors in error.errors)
        if (response.error && 'errors' in response.error) {
          const graphQLErrors = response.error
            .errors as ReadonlyArray<GraphQLError>;
          const alreadyVerified = graphQLErrors.some(
            err => err.extensions?.code === 'EMAIL_ALREADY_VERIFIED',
          );

          if (alreadyVerified) {
            updateUser({ emailVerified: true });
            return;
          }

          errorService.reportError(response.error, {
            operation: 'CodeVerification.resendEmail.graphqlError',
          });
          toast({
            message: t('auth.resendVerificationFailed'),
            type: 'error',
          });
          return;
        }

        logger.debug('Verification email resent');
      },
      error => {
        errorService.reportError(error, {
          operation: 'CodeVerification.resendEmail',
        });
        toast({
          message: t('errors.somethingWentWrong'),
          type: 'error',
        });
      },
    );
  };

  // Don't render if no user or already verified
  if (!user || user.emailVerified) {
    return null;
  }

  if (isAutoVerifying) {
    return (
      <AuthWrapper>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <SousChefLoader
            size="small"
            showBrand={false}
            message={t('auth.verifyingEmail')}
          />
        </View>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <AuthFormTemplate
        onBackPress={onBackToLogin}
        title={t('auth.enterCode')}
        subtitle={
          <>
            {t('auth.enterCodeSubtitlePrefix')}{' '}
            <Text weight="bold">{user.email || t('auth.yourEmail')}</Text>
            {t('auth.enterCodeSubtitleSuffix')}
          </>
        }
        fields={[
          {
            name: 'code',
            label: '',
            component: CodeInputAdapter,
            // Auto-submit as soon as the 6th digit lands. RHF applies the
            // field's onChange synchronously before onComplete fires, so
            // handleSubmit reads the full code.
            props: {
              onComplete: handleSubmit(onVerifyCode, logValidationErrors),
            },
          },
        ]}
        control={control}
        errors={errors}
        linkText={t('auth.skipVerification')}
        onLinkPress={onSkip}
        linkTestID="skip-verification"
        submitText={t('labels.submit')}
        onSubmit={handleSubmit(onVerifyCode, logValidationErrors)}
        footerText={t('auth.didntGetEmail')}
        footerLinkText={t('auth.resendCode')}
        onFooterLinkPress={onResend}
        footerLinkDisabled={countdown > 0}
        footerLinkCountdown={countdown}
      />
    </AuthWrapper>
  );
}
