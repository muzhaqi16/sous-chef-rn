import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { AuthWrapper } from '#features/auth/components/AuthWrapper';
import { AuthFormTemplate } from '#features/auth/components/AuthFormTemplate';
import { CodeInputAdapter } from '#features/auth/components/CodeInputAdapter';
import { useUpdateUser, useUser } from '#store/useAppStore';
import {
  useVerifyEmail,
  type ResendVerificationOutcome,
  type VerifyEmailOutcome,
} from '#features/auth/hooks/useVerifyEmail';
import { alertService } from '#/services/alertService';
import { authService } from '#/services/authService';
import { useEmailVerificationActions } from '#hooks/auth/useEmailVerification';
import { useResendBackoff } from '#features/auth/hooks/useResendBackoff';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAuthNavigation } from '#features/auth/hooks/useAuthNavigation';
import { logger } from '#/utils/environment';
import { logValidationErrors } from '#/utils/validation/common';
import { getEmailVerificationValidationSchema } from '#/utils/validation/auth';
import { toastService } from '#services/toastService';
import { TOAST } from '#/constants/animations';
import { authTestIDs } from '#features/auth/testIDs';

type CodeVerificationValues = {
  code: string;
};

// Where this screen was opened from, deciding the exit, whether a skip link
// shows, and where success lands. `gate` is the root navigator's conditional
// group with no app behind it; `inApp` is pushed over an existing session, so
// backing out IS the skip; `signup` has NO session, because the password was
// refused at sign-up or sign-in — `verifyEmail` is public, so the code still works.
export type VerificationContext = 'gate' | 'inApp' | 'signup';

interface CodeVerificationScreenProps {
  context: VerificationContext;
  /** Address being verified. Falls back to the signed-in user's. */
  email?: string;
  /**
   * Dismisses this screen when a HOST renders it in place of its own content.
   * Navigating to the host's own route is a no-op, so without this the reader
   * has no way off the screen.
   */
  onExit?: () => void;
}

/**
 * A refusal of the code goes under the field, where the user can act on it.
 * Rate limits and transport failures are not a field anyone can correct, so
 * they stay in a toast — and a failure is always said, or the button reads dead.
 */
function presentVerifyOutcome(
  outcome: VerifyEmailOutcome,
  onVerified: () => void,
  reportCodeError: (message: string) => void,
): void {
  if (outcome.status === 'verified') {
    onVerified();
    return;
  }
  if (outcome.status === 'refused') {
    reportCodeError(outcome.body);
    return;
  }
  toastService.error(outcome.body);
}

function presentResendOutcome(
  outcome: ResendVerificationOutcome,
  onVerified: () => void,
): void {
  if (outcome.status === 'sent') {
    logger.debug('Verification email resent');
    return;
  }
  if (outcome.status === 'alreadyVerified') {
    onVerified();
    return;
  }
  // The cooldown is already running, so the failure has to be said.
  toastService.error(outcome.body);
}

export function CodeVerificationScreen({
  context,
  email,
  onExit,
}: CodeVerificationScreenProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const user = useUser();
  const updateUser = useUpdateUser();
  const { skipVerification } = useEmailVerificationActions();
  const { goBack } = useAppNavigation();
  const { navigateToLogin, navigateToForgotPassword } = useAuthNavigation();
  const { verifyEmail, resendVerificationEmail } = useVerifyEmail();

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

  // With no session, the sign-up path passes the address in. The session wins
  // where both exist, so a stale route value cannot redirect a signed-in user's
  // resend.
  const targetEmail = user?.email ?? email ?? null;

  // Under `gate` the root navigator swaps this screen away as the flag flips, so
  // rendering nothing avoids a stale frame; the other contexts navigate
  // themselves and must stay mounted to do it.
  if (context === 'gate' && (!user || user.emailVerified)) {
    return null;
  }

  // The host's dismissal first, because navigating to the route the host is
  // already on changes nothing and leaves this screen mounted.
  const leaveToSignIn = () => {
    onExit?.();
    navigateToLogin();
  };

  const onVerified = () => {
    if (context === 'signup') {
      // `verifyEmail` issues no tokens, and a deleted account comes back under
      // its ORIGINAL password, not the one typed at re-registration.
      toastService.success(t('auth.emailVerifiedToastSignIn'), {
        duration: TOAST.AUTO_DISMISS_LONG,
        action: {
          label: t('auth.forgotPassword'),
          onPress: navigateToForgotPassword,
        },
      });
      leaveToSignIn();
      return;
    }

    // A patch: the store's updateUser assigns these fields onto the existing user.
    updateUser({ emailVerified: true });

    if (context === 'inApp') {
      // Pushed over the app, so it owns its dismissal — leaving it to the root
      // navigator remounts MainApp at its INITIAL route and lands on Home.
      toastService.success(t('auth.emailVerifiedToast'));
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
    // The server picks the code index over the token index by testing
    // `length === 6`, so a stray space silently becomes a token lookup that
    // returns "invalid". Defence in depth; CodeInput already strips non-digits.
    const code = data.code.replace(/\D/g, '');
    // The sentence must be true of a wrong, spent and expired code, and name the resend.
    const outcome = await verifyEmail(
      code,
      targetEmail,
      t('auth.codeInvalidOrExpired'),
    );
    presentVerifyOutcome(outcome, onVerified, reportCodeError);
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
            void authService.logout();
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

    presentResendOutcome(
      await resendVerificationEmail(targetEmail),
      onVerified,
    );
  };

  // Straight after registering there is nothing behind this screen, so the
  // sign-up path has back only where a HOST rendered it in place and can take
  // it away again.
  const onBackPress =
    context === 'gate' ? onSignOut : context === 'inApp' ? goBack : onExit;

  // Sign-up has no skip — skipping writes a per-user flag that no-ops without a
  // session — so "Already verified? Sign In" takes the footer.
  const isSignup = context === 'signup';

  const canResendNow = !!targetEmail;
  const resendSlot = {
    text: canResendNow ? t('auth.resendCode') : undefined,
    onPress: canResendNow ? onResend : undefined,
  };

  return (
    <AuthWrapper
      testID={authTestIDs.codeVerificationScreen}
      onBack={onBackPress}
    >
      <AuthFormTemplate
        title={t('auth.enterCode')}
        subtitle={
          <>
            {t('auth.enterCodeSubtitlePrefix')}{' '}
            <Text role="bodyStrong">{targetEmail ?? t('auth.yourEmail')}</Text>
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
        linkTestID={
          isSignup
            ? authTestIDs.codeVerificationResendLink
            : authTestIDs.codeVerificationSkipLink
        }
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
          isSignup
            ? authTestIDs.codeVerificationSignInLink
            : authTestIDs.codeVerificationResendLink
        }
        onFooterLinkPress={
          isSignup ? leaveToSignIn : targetEmail ? onResend : undefined
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
