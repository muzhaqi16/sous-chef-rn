import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';

import { AuthFormTemplate } from '#components/templates/AuthFormTemplate';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { EmailInput } from '#components/atoms/EmailInput';
import { PasswordInput } from '#components/atoms/PasswordInput';
import { NameInput } from '#components/atoms/NameInput';
import { getSignUpValidationSchema } from '#/utils/validation/auth';
import { logValidationErrors } from '#/utils/validation/common';
import { type RegisterInput } from '#/graphql/generated/schemaTypes';
import { ResendVerificationEmailDocument } from '#operations/auth/auth.generated';
import { authService } from '#/services/authService';
import { useAppStore } from '#store/useAppStore';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';
import { useResendBackoff } from '#hooks/auth/useResendBackoff';
import { useToast } from '#/hooks/useToast';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';

type SignUpValues = RegisterInput & { confirmPassword: string; name: string };

export const SignUpScreen = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { goBack } = useNavigation();
  const toast = useToast();
  const isRegistering = useAppStore(state => state.authIsLoading);
  const { navigateToLogin } = useAuthNavigation();

  // Registration is verification-first: a successful `register` sends an
  // activation email and opens NO session. On success we swap the form for an
  // inline "check your inbox" confirmation (same for a new or already-registered
  // email — existence-blind) instead of navigating into the app.
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);

  // `resendVerificationEmail` is rate-limited server-side, so the button that
  // fires it backs off the same way the code-verification and password-reset
  // resends do — a user tapping it repeatedly hits a countdown, not a 429.
  const { countdown, canResend, registerAttempt } = useResendBackoff();

  const [resendVerificationEmail] = useMutation(
    ResendVerificationEmailDocument,
  );

  const form = useForm<SignUpValues>({
    resolver: yupResolver(getSignUpValidationSchema()),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignUpValues) => {
    const { name, email, password } = data;
    const input: RegisterInput = { name, email, password };

    // Uses default rememberMe=true
    let ok;
    try {
      ok = await authService.register(input);
    } catch (err) {
      authService.handleAuthError(err, 'Registration');
    }

    if (ok) {
      // The activation mail has just gone out, so the cooldown starts here
      // rather than on the first resend — otherwise the first tap could fire a
      // duplicate send seconds after registration.
      registerAttempt();
      setSentToEmail(email);
    }
  };

  const handleResend = async () => {
    if (!sentToEmail || !canResend) return;

    // Counted before the request: the cooldown opens synchronously, so a second
    // tap lands on a disabled button and a failing send can't be retried in a
    // tight loop.
    registerAttempt();

    // Held in a local runner so the try below contains a single plain call —
    // the React Compiler bails out of this component when a `?.`/`??`/ternary
    // sits inside a try body. The catch still covers the whole body.
    const runResend = async () => {
      const result = await resendVerificationEmail({
        variables: { input: { email: sentToEmail } },
      });
      // Under errorPolicy:'all' failures resolve rather than throw — both a
      // resolved error-union member and a transport error land here, so gate
      // the success toast on the payload instead of on reaching this line.
      const succeeded =
        result.data?.resendVerificationEmail?.__typename ===
          'ResendVerificationEmailPayload' && !result.error;
      if (succeeded) {
        toast({ message: t('auth.resendVerificationSent'), type: 'success' });
        return;
      }
      // A throttled send says how long to wait; the generic failure text
      // would read as "try again now", which is the opposite of the truth.
      toast({
        message: isRateLimitError(result.error)
          ? getRateLimitMessage(result.error)
          : t('auth.resendVerificationFailed'),
        type: 'error',
      });
    };

    try {
      await runResend();
    } catch {
      toast({ message: t('auth.resendVerificationFailed'), type: 'error' });
    }
  };

  if (sentToEmail !== null) {
    return (
      <AuthWrapper testID="signup-verification-sent">
        <AuthFormTemplate<SignUpValues>
          title={t('auth.checkInboxTitle')}
          subtitle={t('auth.verificationSentSubtitle', { email: sentToEmail })}
          fields={[]}
          control={form.control}
          errors={form.formState.errors}
          submitText={t('auth.resendEmail')}
          submitButtonTestID="signup-resend-button"
          onSubmit={handleResend}
          submitDisabled={!canResend}
          submitCountdown={countdown}
          footerText={t('auth.alreadyVerified')}
          footerLinkText={t('auth.signIn')}
          footerLinkTestID="signup-verification-login-link"
          onFooterLinkPress={() => navigateToLogin()}
        />
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper testID="signup-screen">
      <AuthFormTemplate<SignUpValues>
        title={t('auth.signupTitle')}
        subtitle={t('auth.signupSubtitle')}
        onBackPress={() => goBack()}
        fields={[
          {
            name: 'name',
            label: t('auth.name'),
            placeholder: t('auth.namePlaceholder'),
            component: NameInput,
            props: { testID: 'signup-name-input' },
          },
          {
            name: 'email',
            label: t('auth.emailAddress'),
            component: EmailInput,
            props: { testID: 'signup-email-input' },
          },
          {
            name: 'password',
            label: t('auth.password'),
            component: PasswordInput,
            props: { testID: 'signup-password-input' },
          },
          {
            name: 'confirmPassword',
            label: t('auth.confirmPassword'),
            component: PasswordInput,
            props: { testID: 'signup-confirm-password-input' },
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        focusChaining
        submitText={
          isRegistering ? t('auth.creatingAccount') : t('auth.signUp')
        }
        submitButtonTestID="signup-submit-button"
        onSubmit={form.handleSubmit(onSubmit, logValidationErrors)}
        footerText={t('auth.haveAccount')}
        footerLinkText={t('auth.signIn')}
        footerLinkTestID="signup-login-link"
        onFooterLinkPress={() => navigateToLogin()}
        isLoading={isRegistering}
      />
    </AuthWrapper>
  );
};
