import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
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
} from '#operations/auth/auth.generated';
import { errorService } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { useEmailVerificationActions } from '#hooks/auth/useEmailVerification';
import { useResendBackoff } from '#hooks/auth/useResendBackoff';
import { logger } from '#/utils/environment';
import { logValidationErrors } from '#/utils/validation/common';
import { getEmailVerificationValidationSchema } from '#/utils/validation/auth';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

type CodeVerificationValues = {
  code: string;
};

/**
 * Deps the response interpreters need from the screen.
 *
 * These interpreters are module-level rather than inline because their bodies
 * are full of `?.` / `&&` / ternaries, and the React Compiler bails out of the
 * whole component when a value block appears inside a try/catch. Calling them
 * from inside the try keeps the catch covering them exactly as before, while
 * leaving the try body plain statements.
 * See scripts/probe-compiler-try-forms.mjs.
 */
interface VerificationResponseDeps {
  updateUser: (patch: { emailVerified: boolean }) => void;
  toast: (options: { message: string; type: 'error' }) => void;
  t: (key: string) => string;
}

function interpretVerifyEmailResponse(
  response: { data?: unknown; error?: unknown },
  { updateUser, toast, t }: VerificationResponseDeps,
): void {
  const payload = (response.data as { verifyEmail?: unknown } | undefined)
    ?.verifyEmail as { __typename?: string; message?: string } | undefined;
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
      'message' in payload && payload.message
        ? payload.message
        : t('errors.verificationFailed');
    toast({ message, type: 'error' });
  }
}

function interpretResendResponse(
  response: { error?: unknown },
  { updateUser, toast, t }: VerificationResponseDeps,
): void {
  // errorPolicy: 'all' returns GraphQL errors on `error.errors`.
  const error = response.error;
  if (!error || !(typeof error === 'object' && 'errors' in error)) {
    logger.debug('Verification email resent');
    return;
  }

  const graphQLErrors = (error as { errors: ReadonlyArray<GraphQLError> })
    .errors;
  const alreadyVerified = graphQLErrors.some(
    err => err.extensions?.code === TopLevelErrorCode.EmailAlreadyVerified,
  );
  if (alreadyVerified) {
    updateUser({ emailVerified: true });
    return;
  }

  errorService.reportError(error, {
    operation: 'CodeVerification.resendEmail.graphqlError',
  });
  toast({ message: t('auth.resendVerificationFailed'), type: 'error' });
}

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

  // A `verify-email` link is routed by the navigator's linking config to
  // EmailVerificationDeepLinkScreen, which owns spending the token. This screen
  // used to listen for the same URL and verify it too, so one tap spent two of
  // the ten `verifyEmail` requests an hour allows. Manual code entry below is
  // the only verification this screen performs.

  // Backoff state for resend rate limiting
  const { countdown, canResend, registerAttempt } = useResendBackoff();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(getEmailVerificationValidationSchema()),
    defaultValues: { code: '' },
  });

  // No navigation effects needed - conditional groups handle it
  useEffect(() => {
    // If user is already verified, the conditional navigation
    // will automatically move them to the next appropriate screen
    if (user?.emailVerified) {
      logger.debug('User email verified, navigation will update automatically');
    }
  }, [user?.emailVerified]);

  const onVerifyCode = async (data: CodeVerificationValues) => {
    try {
      const response = await verifyEmail({
        variables: { input: { code: data.code } },
      });
      interpretVerifyEmailResponse(response, { updateUser, toast, t });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'CodeVerification.verifyEmail',
      });
      toast({
        message: t('errors.codes.genericRetry'),
        type: 'error',
      });
    }
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

  const onResend = async () => {
    // Prevent resend during countdown. Captured up front because the narrowing
    // on `user.email` doesn't survive into the async mutation callback.
    const email = user?.email;
    if (!canResend || !email) return;

    // Counted BEFORE the request, not after it: the cooldown opens
    // synchronously, so a second tap lands on a disabled link instead of firing
    // a duplicate send, and a request that throws can't leave the window open
    // for a tight retry loop.
    registerAttempt();

    try {
      const response = await resendVerificationEmail({
        variables: { input: { email } },
      });
      interpretResendResponse(response, { updateUser, toast, t });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'CodeVerification.resendEmail',
      });
      toast({
        message: t('errors.codes.genericRetry'),
        type: 'error',
      });
    }
  };

  // Don't render if no user or already verified
  if (!user || user.emailVerified) {
    return null;
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
        footerLinkDisabled={!canResend}
        footerLinkCountdown={countdown}
      />
    </AuthWrapper>
  );
}
