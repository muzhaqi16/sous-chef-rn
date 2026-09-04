import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { AuthFormTemplate } from '#features/auth/components/AuthFormTemplate';
import { EmailInput } from '#components/molecules/EmailInput';
import { Text } from '#components/atoms/Text';
import { getForgotPasswordValidationSchema } from '#utils/validation/auth';
import { logValidationErrors } from '#utils/validation/common';
import { AuthWrapper } from '#features/auth/components/AuthWrapper';
import { useRequestPasswordReset } from '#features/auth/hooks/useRequestPasswordReset';
import { useAuthNavigation } from '#features/auth/hooks/useAuthNavigation';
import { useResendBackoff } from '#features/auth/hooks/useResendBackoff';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { isSuccessPayload } from '#/utils/errors/mutationPayload';
import { toastService } from '#services/toastService';
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';
import {
  getRateLimitMessage,
  isRateLimitError,
} from '#/utils/errors/rateLimit';

type ForgotPasswordValues = {
  email: string;
};

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { navigateToLogin } = useAuthNavigation();
  const { requestPasswordReset } = useRequestPasswordReset();
  const { countdown, canResend, registerAttempt } = useResendBackoff();

  // Non-null once the server confirms a send, which is also what switches this
  // screen to its confirmation state.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: yupResolver(getForgotPasswordValidationSchema()),
    defaultValues: { email: '' },
  });

  /**
   * True only when the server CONFIRMED the send: `requestPasswordReset` returns a
   * union, so a refusal resolves 200 with an error member and no transport error.
   */
  const requestResetLink = async (email: string): Promise<boolean> => {
    let response;
    try {
      response = await requestPasswordReset(email);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'ForgotPassword.requestPasswordReset',
      });
    }
    if (!response) {
      toastService.error(t('errors.codes.genericRetry'));
      return false;
    }

    if (isRateLimitError(response.error)) {
      toastService.error(getRateLimitMessage(response.error));
      return false;
    }

    const payload = response.data?.requestPasswordReset;

    if (isSuccessPayload(payload, 'RequestPasswordResetPayload')) return true;

    if (payload) {
      toastService.error(
        localizedRefusalMessage(payload, t('errors.codes.genericRetry')),
      );
      return false;
    }

    toastService.error(t('errors.codes.genericRetry'));
    return false;
  };

  // Both senders count the attempt BEFORE firing, so the cooldown opens
  // synchronously and repeated taps cannot hammer a failing address.
  const onSendResetLink = (data: ForgotPasswordValues) => {
    registerAttempt();
    return executeWithLoadingState(async () => {
      const sent = await requestResetLink(data.email);
      if (sent) setSentTo(data.email);
    }, setSubmitting);
  };

  const onResend = () => {
    if (!canResend || sentTo === null) return;

    registerAttempt();
    return executeWithLoadingState(async () => {
      const sent = await requestResetLink(sentTo);
      if (sent) {
        toastService.success(t('auth.resetLinkResent'));
      }
    }, setSubmitting);
  };

  if (sentTo !== null) {
    return (
      <AuthWrapper testID="forgot-password-sent">
        <AuthFormTemplate<ForgotPasswordValues>
          title={t('auth.resetLinkSentTitle')}
          // Existence-blind by contract: the API returns SENT whether or not the
          // address has an account, so this must not imply one exists.
          subtitle={
            <>
              {t('auth.resetLinkSentPrefix')}
              <Text role="bodyStrong">{sentTo}</Text>
              {t('auth.resetLinkSentSuffix')}
            </>
          }
          fields={[]}
          control={control}
          errors={errors}
          contentPlacement="top"
          submitText={t('auth.backToSignIn')}
          submitButtonTestID="forgot-password-back-to-login-button"
          onSubmit={() => navigateToLogin()}
          isLoading={submitting}
          footerText={t('auth.didntGetEmail')}
          footerLinkText={t('auth.resendResetLink')}
          footerLinkTestID="forgot-password-resend-link"
          onFooterLinkPress={onResend}
          footerLinkDisabled={!canResend || submitting}
          footerLinkCountdown={countdown}
        />
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper testID="forgot-password-screen">
      <AuthFormTemplate<ForgotPasswordValues>
        title={t('auth.forgotPasswordTitle')}
        subtitle={t('auth.forgotPasswordSubtitle')}
        fields={[
          {
            name: 'email',
            label: t('auth.emailAddress'),
            component: EmailInput,
            props: { testID: 'forgot-password-email-input' },
          },
        ]}
        control={control}
        errors={errors}
        contentPlacement="top"
        submitText={t('auth.sendResetLink')}
        submitButtonTestID="forgot-password-submit-button"
        onSubmit={handleSubmit(onSendResetLink, logValidationErrors)}
        isLoading={submitting}
        footerText={t('auth.rememberedIt')}
        footerLinkText={t('auth.signIn')}
        footerLinkTestID="forgot-password-login-link"
        onFooterLinkPress={() => navigateToLogin()}
      />
    </AuthWrapper>
  );
}
