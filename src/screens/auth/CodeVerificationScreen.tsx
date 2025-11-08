import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { GraphQLError } from 'graphql';
import { AuthWrapper, AuthFormTemplate, CodeInputAdapter } from '#components';
import { useStore } from '#store';
import {
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
} from '#generated';

type CodeVerificationValues = {
  code: string;
};

export function CodeVerificationScreen() {
  const { user, updateUser } = useStore();
  const [verifyEmail] = useVerifyEmailMutation();
  const [resendVerificationEmail] = useResendVerificationEmailMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { code: '' },
  });

  // No navigation effects needed - conditional groups handle it
  useEffect(() => {
    // If user is already verified, the conditional navigation
    // will automatically move them to the next appropriate screen
    if (user?.emailVerified) {
      console.log('User email verified, navigation will update automatically');
    }
  }, [user?.emailVerified]);

  const onVerifyCode = async (data: CodeVerificationValues) => {
    try {
      const response = await verifyEmail({
        variables: { code: data.code },
      });

      if (response.data?.verifyEmail) {
        // Just update the user state
        // Navigation happens automatically
        updateUser({ emailVerified: true });
      }
    } catch (error) {
      console.error('Error verifying email:', error);
    }
  };

  const onResend = async () => {
    try {
      if (!user?.email) return;

      const response = await resendVerificationEmail({
        variables: { email: user.email },
      });

      // Check for errors in response (errorPolicy: 'all' returns errors in error.errors)
      if (response.error && 'errors' in response.error) {
        const graphQLErrors = response.error.errors as ReadonlyArray<GraphQLError>;
        const alreadyVerified = graphQLErrors.some(
          (err) => err.extensions?.code === 'EMAIL_ALREADY_VERIFIED',
        );

        if (alreadyVerified) {
          // Update state to mark email as verified
          // Navigation will automatically move to next screen
          updateUser({ emailVerified: true });
          return;
        }

        console.error('Error resending verification email:', response.error);
        return;
      }

      // Show success message only if no errors
      console.log('Verification email resent');
    } catch (error) {
      console.error('Error resending verification email:', error);
    }
  };

  // Don't render if no user or already verified
  if (!user || user.emailVerified) {
    return null;
  }

  return (
    <AuthWrapper>
      <AuthFormTemplate
        title="Enter Code"
        subtitle={
          <>
            We emailed a code to{' '}
            <Text style={{ fontWeight: 'bold' }}>
              {user.email || 'your email'}
            </Text>
            . Please enter the code to continue.
          </>
        }
        fields={[{ name: 'code', label: '', component: CodeInputAdapter }]}
        control={control}
        errors={errors}
        submitText="Submit"
        onSubmit={handleSubmit(onVerifyCode)}
        footerText="Didn't get the email?"
        footerLinkText="Resend code"
        onFooterLinkPress={onResend}
      />
    </AuthWrapper>
  );
}
