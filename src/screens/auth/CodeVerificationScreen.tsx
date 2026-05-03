import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Linking, View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { GraphQLError } from 'graphql';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { AuthFormTemplate } from '#components/templates/AuthFormTemplate';
import { CodeInputAdapter } from '#components/molecules/CodeInputAdapter';
import { useAppStore } from '#store/useAppStore';
import { useToast } from '#/hooks/useToast';
import { useMutation } from '@apollo/client/react';
import {
  VerifyEmailDocument,
  ResendVerificationEmailDocument,
} from '#operations/auth/auth.generated';
import { errorService } from '#/services/errorService';
import { logger } from '#/utils/environment';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import type { ToastFn } from '#/components/atoms/Toast';
import { SousChefLoader } from '#/components/base/SousChefLoader';

function extractVerificationToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes('verify-email')) return null;
    const token = parsed.searchParams.get('token');
    if (!token || !/^[0-9a-fA-F]{32 }$/.test(token)) return null;
    return token;
  } catch {
    return null;
  }
}

/** Module-level async function to handle deep link auto-verification.
 *  Extracted from component body to avoid try-catch bailout. */
async function performAutoVerify(
  token: string,
  verifyEmail: (opts: { variables: { code: string } }) => Promise<any>,
  updateUser: (patch: { emailVerified: boolean }) => void,
  toast: ToastFn,
  setIsAutoVerifying: (v: boolean) => void,
  autoVerifyProcessedRef: React.RefObject<boolean>,
): Promise<void> {
  try {
    logger.info('Auto-verifying email from deep link', {
      tokenPrefix: token.substring(0, 8) + '...',
    });

    const result = await verifyEmail({ variables: { code: token } });

    if (result.data?.verifyEmail?.success) {
      updateUser({ emailVerified: true });
      toast({ message: 'Email verified successfully!', type: 'success' });
    } else {
      throw new Error(
        result.data?.verifyEmail?.message || 'Verification failed',
      );
    }
  } catch (error: any) {
    logger.error('Auto-verify failed', { error });
    const errorMsg =
      error.message ||
      'Verification failed. The link may be expired or invalid.';
    toast({ message: errorMsg, type: 'error' });
    setIsAutoVerifying(false);
    autoVerifyProcessedRef.current = false;
  }
}

// Exponential backoff delays in seconds: immediate, then 30s, 1m, 3m, 5m
const RESEND_BACKOFF_DELAYS = [0, 30, 60, 180, 300];

const getBackoffDelay = (attemptCount: number): number => {
  const index = Math.min(attemptCount, RESEND_BACKOFF_DELAYS.length - 1);
  return RESEND_BACKOFF_DELAYS[index];
};

type CodeVerificationValues = {
  code: string;
};

export function CodeVerificationScreen(): React.JSX.Element | null {
  const user = useAppStore(state => state.user);
  const updateUser = useAppStore(state => state.updateUser);
  const toast = useToast();
  const [verifyEmail] = useMutation(VerifyEmailDocument);
  const [resendVerificationEmail] = useMutation(
    ResendVerificationEmailDocument,
  );

  // Auto-verify state for deep link handling
  const [isAutoVerifying, setIsAutoVerifying] = useState(false);
  const autoVerifyProcessedRef = useRef(false);

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

  // Listen for deep link URLs (cold start + warm start)
  useEffect(() => {
    const handleUrl = (url: string) => {
      const token = extractVerificationToken(url);
      if (token) {
        // Inline autoVerify logic to avoid dependency on function that changes every render
        if (autoVerifyProcessedRef.current) return;
        autoVerifyProcessedRef.current = true;
        setIsAutoVerifying(true);

        performAutoVerify(
          token,
          verifyEmail,
          updateUser,
          toast,
          setIsAutoVerifying,
          autoVerifyProcessedRef,
        );
      }
    };

    // Cold start: app was killed, opened via deep link
    Linking.getInitialURL().then(url => {
      if (url) handleUrl(url);
    });

    // Warm start: app in background, opened via deep link
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, [verifyEmail, updateUser, toast]);

  // No navigation effects needed - conditional groups handle it
  useEffect(() => {
    // If user is already verified, the conditional navigation
    // will automatically move them to the next appropriate screen
    if (user?.emailVerified) {
      console.log('User email verified, navigation will update automatically');
    }
  }, [user?.emailVerified]);

  // Start countdown timer for backoff
  const startCountdown = (seconds: number) => {
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
  };

  const onVerifyCode = (data: CodeVerificationValues) => {
    executeMutation(
      async () => {
        const response = await verifyEmail({
          variables: { code: data.code },
        });

        if (response.data?.verifyEmail.success) {
          updateUser({ emailVerified: true });
        } else if (response.data?.verifyEmail) {
          toast({ message: response.data.verifyEmail.message, type: 'error' });
        }
      },
      error => {
        errorService.reportError(error, {
          operation: 'CodeVerification.verifyEmail',
        });
        toast({
          message: 'Something went wrong. Please try again.',
          type: 'error',
        });
      },
    );
  };

  const onResend = () => {
    // Prevent resend during countdown
    if (countdown > 0 || !user?.email) return;

    executeMutation(
      async () => {
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
          const graphQLErrors = response.error
            .errors as ReadonlyArray<GraphQLError>;
          const alreadyVerified = graphQLErrors.some(
            err => err.extensions?.code === 'EMAIL_ALREADY_VERIFIED',
          );

          if (alreadyVerified) {
            updateUser({ emailVerified: true });
            return;
          }

          errorService.reportError(response.error, {
            operation: 'CodeVerification.resendEmail.graphqlError',
          });
          toast({
            message: 'Failed to resend verification email.',
            type: 'error',
          });
          return;
        }

        console.log('Verification email resent');
      },
      error => {
        errorService.reportError(error, {
          operation: 'CodeVerification.resendEmail',
        });
        toast({
          message: 'Something went wrong. Please try again.',
          type: 'error',
        });
      },
    );
  };

  // Don't render if no user or already verified
  if (!user || user.emailVerified) {
    return null;
  }

  if (isAutoVerifying) {
    return (
      <AuthWrapper>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <SousChefLoader
            size="small"
            showBrand={false}
            message="Verifying your email..."
          />
        </View>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <AuthFormTemplate
        title="Enter Code"
        subtitle={
          <>
            We emailed a code to{' '}
            <Text weight="bold">{user.email || 'your email'}</Text>. Please
            enter the code to continue.
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
