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
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { toastService } from '#services/toastService';
import { authTestIDs } from '#features/auth/testIDs';

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

  /** True only when the server CONFIRMED the send; anything else is toasted. */
  const requestResetLink = async (email: string): Promise<boolean> => {
    const refusal = await requestPasswordReset(email);
    if (refusal === null) return true;
    toastService.error(refusal);
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
      <AuthWrapper testID={authTestIDs.forgotPasswordSentView}>
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
          submitText={t('auth.backToSignIn')}
          submitButtonTestID={authTestIDs.forgotPasswordBackToLoginButton}
          onSubmit={() => navigateToLogin()}
          isLoading={submitting}
          footerText={t('auth.didntGetEmail')}
          footerLinkText={t('auth.resendResetLink')}
          footerLinkTestID={authTestIDs.forgotPasswordResendLink}
          onFooterLinkPress={onResend}
          footerLinkDisabled={!canResend || submitting}
          footerLinkCountdown={countdown}
        />
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper testID={authTestIDs.forgotPasswordScreen}>
      <AuthFormTemplate<ForgotPasswordValues>
        title={t('auth.forgotPasswordTitle')}
        subtitle={t('auth.forgotPasswordSubtitle')}
        fields={[
          {
            name: 'email',
            label: t('auth.emailAddress'),
            component: EmailInput,
            props: { testID: authTestIDs.forgotPasswordEmailInput },
          },
        ]}
        control={control}
        errors={errors}
        submitText={t('auth.sendResetLink')}
        submitButtonTestID={authTestIDs.forgotPasswordSubmitButton}
        onSubmit={handleSubmit(onSendResetLink, logValidationErrors)}
        isLoading={submitting}
        footerText={t('auth.rememberedIt')}
        footerLinkText={t('auth.signIn')}
        footerLinkTestID={authTestIDs.forgotPasswordLoginLink}
        onFooterLinkPress={() => navigateToLogin()}
      />
    </AuthWrapper>
  );
}
