import React, { useState } from 'react';
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
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';
import { useEmailVerificationActions } from '#hooks/auth/useEmailVerification';
import { useResendBackoff } from '#hooks/auth/useResendBackoff';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';
import { logger } from '#/utils/environment';
import { logValidationErrors } from '#/utils/validation/common';
import { getEmailVerificationValidationSchema } from '#/utils/validation/auth';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

type CodeVerificationValues = {
  code: string;
};

// Where this screen was opened from, deciding the exit, whether a skip link
// shows, and where success lands. `gate` is the root navigator's conditional
// group with no app behind it; `inApp` is pushed over an existing session, so
// backing out IS the skip; `signup` has NO session at all, because `register`
// issues no tokens — `verifyEmail` is public, so the code still works.
export type VerificationContext = 'gate' | 'inApp' | 'signup';

interface CodeVerificationScreenProps {
  context: VerificationContext;
  /** Address being verified. Falls back to the signed-in user's. */
  email?: string;
}

/**
 * The interpreters are module-level because their bodies are full of value blocks,
 * which bail the React Compiler out of the whole component when they sit inside a
 * try. Calling them from the try keeps the catch's coverage with plain statements.
 */
interface VerificationResponseDeps {
  onVerified: () => void;
  toast: (options: { message: string; type: 'error' }) => void;
  /** Puts a refusal under the code field, where the user can act on it. */
  reportCodeError: (message: string) => void;
  t: (key: string) => string;
}

function interpretVerifyEmailResponse(
  response: { data?: unknown; error?: unknown },
  { onVerified, toast, reportCodeError, t }: VerificationResponseDeps,
): void {
  const payload = (response.data as { verifyEmail?: unknown } | undefined)
    ?.verifyEmail as
    | { __typename?: string; code?: string | null; field?: string | null }
    | undefined;
  if (payload?.__typename === 'VerifyEmailPayload') {
    onVerified();
    return;
  }
  // Auth failures arrive as top-level GraphQL errors, not an AuthError union
  // variant. Rate limits and transport failures are not a field the user can
  // correct, so they stay in a toast.
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
    // The payload's `message` is never displayed — unlocalizable English by
    // construction. A ValidationError takes this screen's own sentence, not the
    // code map's generic "check your input": the only one `verifyEmail` returns
    // IS a bad code, and the server collapses wrong/spent/expired into it, so the
    // sentence must be true of all three and name the resend.
    reportCodeError(
      payload.__typename === 'ValidationError'
        ? t('auth.codeInvalidOrExpired')
        : localizedRefusalMessage(payload, t('auth.codeInvalidOrExpired')),
    );
  }
}

function interpretResendResponse(
  response: { error?: unknown },
  { onVerified, toast, t }: VerificationResponseDeps,
): void {
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
    onVerified();
    return;
  }

  errorService.reportError(error, {
    operation: 'CodeVerification.resendEmail.graphqlError',
  });
  toast({ message: t('auth.resendVerificationFailed'), type: 'error' });
}

export function CodeVerificationScreen({
  context,
  email,
}: CodeVerificationScreenProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const user = useUser();
  const updateUser = useUpdateUser();
  const toast = useToast();
  const { skipVerification } = useEmailVerificationActions();
  const { goBack } = useAppNavigation();
  const { navigateToLogin } = useAuthNavigation();
  const [verifyEmail] = useMutation(VerifyEmailDocument);
  const [resendVerificationEmail] = useMutation(
    ResendVerificationEmailDocument,
  );

  // Manual code entry is the ONLY verification this screen performs: a
  // `verify-email` link routes to EmailVerificationDeepLinkScreen, which owns
  // spending the token, and verifying here too would double-spend the hourly
  // `verifyEmail` budget.

  // Registration has just dispatched the activation mail, so the sign-up path
  // opens inside the first cooldown rather than offering an immediate resend.
  const { countdown, canResend, registerAttempt } = useResendBackoff(
    context === 'signup' ? 1 : 0,
  );

  // Held here rather than in `setError`: RHF publishes the form state captured
  // BEFORE `onValid` when the submit settles, wiping an error set inside it.
  const [refusal, setRefusal] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(getEmailVerificationValidationSchema()),
    defaultValues: { code: '' },
  });

  // `register` opens no session, so the sign-up path passes the address in. The
  // session wins where both exist, so a stale route value cannot redirect a
  // signed-in user's resend.
  const targetEmail = user?.email ?? email ?? null;

  // Under `gate` the root navigator swaps this screen away as the flag flips, so
  // rendering nothing avoids a stale frame; the other contexts navigate
  // themselves and must stay mounted to do it.
  if (context === 'gate' && (!user || user.emailVerified)) {
    return null;
  }

  const onVerified = () => {
    if (context === 'signup') {
      // `verifyEmail` returns the user but no tokens, so the sign-up path is left
      // with no session and signing in is the next step.
      toast({ message: t('auth.emailVerifiedToast'), type: 'success' });
      navigateToLogin();
      return;
    }

    // A patch: the store's updateUser assigns these fields onto the existing user.
    updateUser({ emailVerified: true });

    if (context === 'inApp') {
      // Pushed over the app, so it owns its dismissal — leaving it to the root
      // navigator remounts MainApp at its INITIAL route and lands on Home.
      toast({ message: t('auth.emailVerifiedToast'), type: 'success' });
      goBack();
    }
  };

  const reportCodeError = (message: string) => {
    setValue('code', '');
    setRefusal(message);
  };

  // A server refusal renders exactly like a schema error, in the same place.
  const fieldErrors = refusal
    ? { ...errors, code: { type: 'server', message: refusal } }
    : errors;

  const onVerifyCode = async (data: CodeVerificationValues) => {
    setRefusal(null);
    try {
      // The server picks the code index over the token index by testing
      // `length === 6`, so a stray space silently becomes a token lookup that
      // returns "invalid". Defence in depth; CodeInput already strips non-digits.
      const code = data.code.replace(/\D/g, '');
      const response = await verifyEmail({ variables: { input: { code } } });
      interpretVerifyEmailResponse(response, {
        onVerified,
        toast,
        reportCodeError,
        t,
      });
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

  // The only way off the sign-in GATE without a working code: RootNavigator
  // re-derives that target from `user` on every change, so nothing but clearing
  // the user moves them. Logout is entirely local, so this works with the API down.
  const onSignOut = () => {
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

  // Deferring is a real choice, so it states the cost: no sharing until verified.
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
    // Captured up front: the address narrowing doesn't survive into the async
    // mutation callback.
    if (!canResend || !targetEmail) return;

    // Counted BEFORE the request, so the cooldown opens synchronously: a second
    // tap lands on a disabled link, and a throw cannot leave the window open.
    registerAttempt();

    try {
      const response = await resendVerificationEmail({
        variables: { input: { email: targetEmail } },
      });
      interpretResendResponse(response, {
        onVerified,
        toast,
        reportCodeError,
        t,
      });
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

  // Back means nothing on the sign-up path: the account exists, so the filled
  // form would only offer a submit now guaranteed to be refused.
  const onBackPress =
    context === 'gate' ? onSignOut : context === 'inApp' ? goBack : undefined;

  // Sign-up has no back and no skip — skipping writes a per-user flag that no-ops
  // without a session — so "Already verified? Sign In" is the only way off this
  // screen for someone who followed the mail link, and it takes the footer.
  const isSignup = context === 'signup';

  const canResendNow = !!targetEmail;
  const resendSlot = {
    text: canResendNow ? t('auth.resendCode') : undefined,
    onPress: canResendNow ? onResend : undefined,
  };

  return (
    <AuthWrapper testID="code-verification-screen">
      <AuthFormTemplate
        contentPlacement="top"
        onBackPress={onBackPress}
        title={t('auth.enterCode')}
        subtitle={
          <>
            {t('auth.enterCodeSubtitlePrefix')}{' '}
            <Text weight="bold">{targetEmail || t('auth.yourEmail')}</Text>
            {t('auth.enterCodeSubtitleSuffix')}
          </>
        }
        fields={[
          {
            name: 'code',
            label: '',
            component: CodeInputAdapter,
            // RHF applies the field's onChange synchronously before onComplete
            // fires, so handleSubmit reads the full code.
            props: {
              onComplete: handleSubmit(onVerifyCode, logValidationErrors),
            },
          },
        ]}
        control={control}
        errors={fieldErrors}
        linkText={
          isSignup
            ? resendSlot.text
            : context === 'gate'
            ? t('auth.skipVerification')
            : undefined
        }
        onLinkPress={
          isSignup
            ? resendSlot.onPress
            : context === 'gate'
            ? onSkip
            : undefined
        }
        linkTestID={isSignup ? 'resend-code' : 'skip-verification'}
        linkDisabled={isSignup ? !canResend : undefined}
        linkCountdown={isSignup ? countdown : undefined}
        submitText={t('labels.submit')}
        onSubmit={handleSubmit(onVerifyCode, logValidationErrors)}
        footerText={
          isSignup
            ? t('auth.alreadyVerified')
            : targetEmail
            ? t('auth.didntGetEmail')
            : undefined
        }
        footerLinkText={
          isSignup
            ? t('auth.signIn')
            : targetEmail
            ? t('auth.resendCode')
            : undefined
        }
        footerLinkTestID={
          isSignup ? 'code-verification-sign-in' : 'resend-code'
        }
        onFooterLinkPress={
          isSignup ? navigateToLogin : targetEmail ? onResend : undefined
        }
        footerLinkDisabled={isSignup ? false : !canResend}
        footerLinkCountdown={isSignup ? 0 : countdown}
      />
    </AuthWrapper>
  );
}

export function VerificationGateScreen(): React.JSX.Element | null {
  return <CodeVerificationScreen context="gate" />;
}

/**
 * Verification from inside the app. A pushed screen, not a group swap, so both
 * exits return the user where they came from.
 */
export function VerifyEmailScreen(): React.JSX.Element | null {
  return <CodeVerificationScreen context="inApp" />;
}
