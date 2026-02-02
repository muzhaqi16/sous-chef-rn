import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { GraphQLError } from 'graphql';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { AuthFormTemplate } from '#components/templates/AuthFormTemplate';
import { CodeInputAdapter } from '#components/molecules/CodeInputAdapter';
import { useAppStore } from '#store/useAppStore';
import {
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
} from '#generated';

// Exponential backoff delays in seconds: immediate, then 30s, 1m, 3m, 5m
const RESEND_BACKOFF_DELAYS = [0, 30, 60, 180, 300];

const getBackoffDelay = (attemptCount: number): number => {
  const index = Math.min(attemptCount, RESEND_BACKOFF_DELAYS.length - 1);
  return RESEND_BACKOFF_DELAYS[index];
};

type CodeVerificationValues = {
  code: string;
};

export function CodeVerificationScreen() {
  const user = useAppStore(state => state.user);
  const updateUser = useAppStore(state => state.updateUser);
  const [verifyEmail] = useVerifyEmailMutation();
  const [resendVerificationEmail] = useResendVerificationEmailMutation();

  // Backoff state for resend rate limiting
  const [resendAttempts, setResendAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { code: '' },
  });

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // No navigation effects needed - conditional groups handle it
  useEffect(() => {
    // If user is already verified, the conditional navigation
    // will automatically move them to the next appropriate screen
    if (user?.emailVerified) {
      console.log('User email verified, navigation will update automatically');
    }
  }, [user?.emailVerified]);

  // Start countdown timer for backoff
  const startCountdown = useCallback((seconds: number) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    setCountdown(seconds);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

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
    // Prevent resend during countdown
    if (countdown > 0 || !user?.email) return;

    try {
      const response = await resendVerificationEmail({
        variables: { email: user.email },
      });

      // Increment attempts and start countdown for next request
      const newAttempts = resendAttempts + 1;
      setResendAttempts(newAttempts);
      const nextDelay = getBackoffDelay(newAttempts);
      if (nextDelay > 0) {
        startCountdown(nextDelay);
      }

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
        footerLinkDisabled={countdown > 0}
        footerLinkCountdown={countdown}
      />
    </AuthWrapper>
  );
}
