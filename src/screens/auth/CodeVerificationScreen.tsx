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

/**
 * Where this screen was opened from. It decides the exit, whether a skip link
 * shows, and where a successful verification lands — the only three things that
 * differ between the three entry points.
 *
 * - `gate`   — the root navigator's `verification` conditional group, entered by
 *              signing in with an unverified address. There is no app behind it
 *              yet, so the only way out without a code is to sign out (or skip).
 * - `inApp`  — pushed over the app from the profile banner or the collaborate
 *              gate. The user already has a session and a screen to return to,
 *              so back is a plain `goBack()` and backing out IS the skip.
 * - `signup` — rendered by SignUpScreen with NO session, because `register`
 *              issues no tokens. `verifyEmail` is public, so the code still
 *              works; activating simply lands on sign-in.
 */
export type VerificationContext = 'gate' | 'inApp' | 'signup';

interface CodeVerificationScreenProps {
  context: VerificationContext;
  /** Address being verified. Falls back to the signed-in user's. */
  email?: string;
}

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
  // Auth failures now arrive as top-level GraphQL errors, not an
  // AuthError union variant. Rate limits and transport failures are not a
  // field the user can correct, so they stay in a toast.
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
    // The payload's own `message` is never displayed — it is unlocalizable
    // English by construction.
    //
    // A ValidationError takes this screen's own sentence rather than the code
    // map's. The only ValidationError `verifyEmail` can return IS a bad code,
    // and the map sends its `VALIDATION_FAILED` to the generic "check your
    // input and try again" — which tells someone staring at six digits nothing
    // and never mentions the resend. The server collapses "wrong code",
    // "already spent" and "expired" into that one error, so the sentence has
    // to be true of all three and name the recovery.
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

  // A `verify-email` link is routed by the navigator's linking config to
  // EmailVerificationDeepLinkScreen, which owns spending the token. This screen
  // used to listen for the same URL and verify it too, so one tap spent two of
  // the ten `verifyEmail` requests an hour allows. Manual code entry below is
  // the only verification this screen performs.

  // Backoff state for resend rate limiting. Registration has just dispatched
  // the activation mail, so the sign-up path opens already inside the first
  // cooldown rather than offering an immediate resend.
  const { countdown, canResend, registerAttempt } = useResendBackoff(
    context === 'signup' ? 1 : 0,
  );

  // Held here rather than in `setError`: this runs inside `handleSubmit`'s
  // onValid callback, and RHF publishes the form state it captured BEFORE that
  // callback when the submit settles — wiping an error set inside it. The
  // refusal simply never appeared. Verified on device 2026-08-29.
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

  // `register` opens no session, so the sign-up path has no user to read the
  // address from and passes it in. The session wins where both exist, so a
  // stale route value can never redirect a signed-in user's resend.
  const targetEmail = user?.email ?? email ?? null;

  // Under `gate` the root navigator swaps this screen away the moment the flag
  // flips; rendering nothing avoids a frame of stale UI. The other two contexts
  // navigate themselves and must stay mounted long enough to do it.
  if (context === 'gate' && (!user || user.emailVerified)) {
    return null;
  }

  const onVerified = () => {
    if (context === 'signup') {
      // `verifyEmail` returns the user but no tokens, so activating from the
      // sign-up path leaves no session — signing in is the next step, exactly
      // as EmailVerificationDeepLinkScreen concludes for its own `!userId` case.
      toast({ message: t('auth.emailVerifiedToast'), type: 'success' });
      navigateToLogin();
      return;
    }

    // A patch, not a spread of the whole user: the store's updateUser assigns
    // the given fields onto the existing user.
    updateUser({ emailVerified: true });

    if (context === 'inApp') {
      // Pushed over the app, so the screen owns its own dismissal. Leaving it
      // to the root navigator would remount the MainApp group at its INITIAL
      // route and drop the user on Home instead of the screen they came from.
      toast({ message: t('auth.emailVerifiedToast'), type: 'success' });
      goBack();
    }
  };

  const reportCodeError = (message: string) => {
    // Blanking the cells readies them for the retype.
    setValue('code', '');
    setRefusal(message);
  };

  // A server refusal is displayed exactly like a schema error, so the field
  // renders it in the same place with no special casing downstream.
  const fieldErrors = refusal
    ? { ...errors, code: { type: 'server', message: refusal } }
    : errors;

  const onVerifyCode = async (data: CodeVerificationValues) => {
    // Last attempt's refusal is stale the moment a new one is in flight.
    setRefusal(null);
    try {
      // The server picks the code index over the token index by testing
      // `length === 6`, so a stray separator or space silently becomes a token
      // lookup and comes back "invalid". CodeInput already strips non-digits;
      // this is defence in depth for any future prefill that bypasses it.
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

  // The only way off the sign-in GATE without a working code. `verification` is
  // a conditional group holding one headerless screen, and RootNavigator
  // re-derives that target from `user` on every change — so nothing but
  // clearing the user can move them. Logout is entirely local (LogoutCleanup
  // cancels timers and subscriptions; device deregistration is
  // fire-and-forget), so this still works when the mail server, or the whole
  // API, is down.
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
    // on the address doesn't survive into the async mutation callback.
    if (!canResend || !targetEmail) return;

    // Counted BEFORE the request, not after it: the cooldown opens
    // synchronously, so a second tap lands on a disabled link instead of firing
    // a duplicate send, and a request that throws can't leave the window open
    // for a tight retry loop.
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

  // Back means something different per context, and on the sign-up path it
  // means nothing at all — the account already exists, so returning to the
  // filled form would only offer a submit that is now guaranteed to be refused.
  const onBackPress =
    context === 'gate' ? onSignOut : context === 'inApp' ? goBack : undefined;

  // Sign-up has no back button and no skip — the account exists, and skipping
  // writes a per-user flag that no-ops without a session. So "Already verified?
  // Sign In" is the ONLY way off this screen for someone who followed the link
  // in the mail instead of typing the code, and it gets the footer, where the
  // eye already goes. Resend moves up to the link slot, which is where
  // "Forgot password?" sits on the sign-in screen.
  const isSignup = context === 'signup';

  const canResendNow = !!targetEmail;
  const resendSlot = {
    text: canResendNow ? t('auth.resendCode') : undefined,
    onPress: canResendNow ? onResend : undefined,
  };

  return (
    <AuthWrapper testID="code-verification-screen">
      <AuthFormTemplate
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
            // Auto-submit as soon as the 6th digit lands. RHF applies the
            // field's onChange synchronously before onComplete fires, so
            // handleSubmit reads the full code.
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

/**
 * The post-login gate, registered in RootNavigator's `verification` group.
 */
export function VerificationGateScreen(): React.JSX.Element | null {
  return <CodeVerificationScreen context="gate" />;
}

/**
 * Verification reached from inside the app — the profile banner and the
 * collaborate gate. A pushed screen, not a navigator group swap, so both exits
 * (back, and a successful verify) return the user where they came from.
 */
export function VerifyEmailScreen(): React.JSX.Element | null {
  return <CodeVerificationScreen context="inApp" />;
}
