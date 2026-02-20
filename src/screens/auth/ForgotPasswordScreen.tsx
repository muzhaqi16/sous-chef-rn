import React from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import { EmailInput } from '../../components/atoms/EmailInput';
import {getForgotPasswordValidationSchema} from '#utils/validation/auth';
import {AuthWrapper} from '../../components/templates/AuthWrapper';
import {useForgotPasswordMutation} from '../../graphql/generated';
import {useAuthNavigation} from '#hooks/navigation/useAuthNavigation';
import { errorService } from '#/services/errorService';

type ForgotPasswordValues = {
  email: string;
};

export function ForgotPasswordScreen() {
  const {navigateToLogin} = useAuthNavigation();
  const [forgotPasswordApi] = useForgotPasswordMutation();

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<ForgotPasswordValues>({
    resolver: yupResolver(getForgotPasswordValidationSchema()),
    defaultValues: {email: ''},
  });

  const sendResetEmail = async (data: ForgotPasswordValues) => {
    const {email} = data;
    // Simulate sending reset email
    try {
      await forgotPasswordApi({
        variables: {email},
      });
      // On success, navigate to login
      navigateToLogin();
    } catch (error) {
      errorService.reportError(error, { operation: 'ForgotPassword.sendResetEmail' });
    }
    // Here you would typically call your API to send the reset email
    // For example: await api.sendResetEmail(email);
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
            props: {testID: 'forgot-password-email-input'},
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
