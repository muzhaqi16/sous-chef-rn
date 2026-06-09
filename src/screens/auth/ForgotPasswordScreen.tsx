import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from 'react-i18next';
import { AuthFormTemplate } from '../../components/templates/AuthFormTemplate';
import { EmailInput } from '../../components/atoms/EmailInput';
import { getForgotPasswordValidationSchema } from '#utils/validation/auth';
import { logValidationErrors } from '#utils/validation/common';
import { AuthWrapper } from '../../components/templates/AuthWrapper';
import { useMutation } from '@apollo/client/react';
import { ForgotPasswordDocument } from '#operations/auth/auth.generated';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';
import { useToast } from '#/hooks/useToast';
import { errorService } from '#/services/errorService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
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
  const [forgotPasswordApi] = useMutation(ForgotPasswordDocument);
  const toast = useToast();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: yupResolver(getForgotPasswordValidationSchema()),
    defaultValues: { email: '' },
  });

  const sendResetEmail = async (data: ForgotPasswordValues) => {
    const { email } = data;
    const response = await executeMutation(
      () => forgotPasswordApi({ variables: { input: { email } } }),
      error =>
        errorService.reportError(error, {
          operation: 'ForgotPassword.sendResetEmail',
        }),
    );
    // `false` means the mutation threw — already reported above.
    if (!response) return;

    // Rate-limit now arrives as a top-level GraphQL error, not a
    // RateLimitError union variant.
    if (isRateLimitError(response.error)) {
      toast({
        message: getRateLimitMessage(response.error),
        type: 'error',
      });
      return;
    }

    navigateToLogin();
  };

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
        submitText={t('auth.sendResetLink')}
        submitButtonTestID="forgot-password-submit-button"
        onSubmit={handleSubmit(sendResetEmail, logValidationErrors)}
        footerText={t('auth.rememberedIt')}
        footerLinkText={t('auth.signIn')}
        footerLinkTestID="forgot-password-login-link"
        onFooterLinkPress={() => navigateToLogin()}
      />
    </AuthWrapper>
  );
}
