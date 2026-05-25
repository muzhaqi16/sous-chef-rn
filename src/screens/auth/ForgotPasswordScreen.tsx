import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { AuthFormTemplate } from '../../components/templates/AuthFormTemplate';
import { EmailInput } from '../../components/atoms/EmailInput';
import { getForgotPasswordValidationSchema } from '#utils/validation/auth';
import { AuthWrapper } from '../../components/templates/AuthWrapper';
import { useMutation } from '@apollo/client/react';
import { ForgotPasswordDocument } from '#operations/auth/auth.generated';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';
import { useToast } from '#/hooks/useToast';
import { errorService } from '#/services/errorService';
import { getRateLimitMessage } from '#/utils/errors/rateLimit';

type ForgotPasswordValues = {
  email: string;
};

export function ForgotPasswordScreen() {
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
    try {
      const response = await forgotPasswordApi({
        variables: { input: { email } },
      });

      const payload = response.data?.forgotPassword;
      if (payload?.__typename === 'RateLimitError') {
        toast({
          message: getRateLimitMessage({
            extensions: { code: payload.code, retryAfter: payload.retryAfter },
          }),
          type: 'error',
        });
        return;
      }

      navigateToLogin();
    } catch (error) {
      errorService.reportError(error, {
        operation: 'ForgotPassword.sendResetEmail',
      });
    }
  };

  return (
    <AuthWrapper testID="forgot-password-screen">
      <AuthFormTemplate<ForgotPasswordValues>
        title="Forgot password"
        subtitle="Enter your email to reset"
        fields={[
          {
            name: 'email',
            label: 'Email address',
            component: EmailInput,
            props: { testID: 'forgot-password-email-input' },
          },
        ]}
        control={control}
        errors={errors}
        submitText="Send Reset Link"
        submitButtonTestID="forgot-password-submit-button"
        onSubmit={handleSubmit(sendResetEmail)}
        footerText="Remembered it?"
        footerLinkText="Sign In"
        footerLinkTestID="forgot-password-login-link"
        onFooterLinkPress={() => navigateToLogin()}
      />
    </AuthWrapper>
  );
}
