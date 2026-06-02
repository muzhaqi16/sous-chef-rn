import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Header } from '#components/molecules/Header';
import { useUpdateUser, useUser } from '#store/useAppStore';
import { useMutation } from '@apollo/client/react';
import {
  VerifyEmailDocument,
  type VerifyEmailMutation,
  type VerifyEmailMutationVariables,
} from '#operations/auth/auth.generated';
import { logger } from '#/utils/environment';
import { useToast } from '#/hooks/useToast';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import { errorService } from '#/services/errorService';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { Text } from '#components/atoms/Text';

interface EmailVerificationRouteParams {
  token: string;
}

/** Module-level try-catch extraction for React Compiler compatibility */
async function performVerificationImpl(
  token: string | undefined,
  verifyEmail: useMutation.MutationFunction<
    VerifyEmailMutation,
    VerifyEmailMutationVariables
  >,
  user: ReturnType<typeof useUser>,
  updateUser: (updates: Partial<{ emailVerified: boolean }>) => void,
  toast: ReturnType<typeof useToast>,
  setVerificationResult: (v: 'success' | 'error' | null) => void,
  setErrorMessage: (v: string) => void,
  setIsVerifying: (v: boolean) => void,
): Promise<void> {
  if (!token) {
    setVerificationResult('error');
    setErrorMessage('Invalid verification token');
    setIsVerifying(false);
    return;
  }

  setIsVerifying(true);
  setVerificationResult(null);
  setErrorMessage('');

  await executeMutation(
    async () => {
      logger.info('Attempting email verification', {
        tokenPrefix: token.substring(0, 8) + '...',
        userId: user?.id,
      });

      const result = await verifyEmail({
        variables: { input: { code: token } },
      });

      const payload = result.data?.verifyEmail;
      if (payload?.__typename === 'VerifyEmailPayload') {
        logger.info('Email verification successful');

        if (user) {
          updateUser({ ...user, emailVerified: true });
        }

        setVerificationResult('success');

        toast({
          message: 'Email verified successfully!',
          type: 'success',
        });
      } else {
        // Auth failures now arrive as top-level GraphQL errors, not an
        // AuthError union variant.
        const topLevelError = getTopLevelGraphQLError(result.error);
        if (topLevelError) {
          throw new Error(
            errorService.getUserFriendlyMessage(
              topLevelError.code,
              topLevelError.message,
            ),
          );
        }
        const message =
          payload && 'message' in payload ? payload.message : null;
        throw new Error(message ?? 'Verification failed');
      }
      return result;
    },
    (error: unknown) => {
      const err = error as Error;
      logger.error('Email verification failed', { error });

      const errorMsg =
        err.message ||
        'Verification failed. The link may be expired or invalid.';
      setErrorMessage(errorMsg);
      setVerificationResult('error');

      toast({
        message: errorMsg,
        type: 'error',
      });
    },
  );

  setIsVerifying(false);
}

export const EmailVerificationDeepLinkScreen: React.FC = () => {
  const route = useRoute();
  const { goBack } = useNavigation();
  const user = useUser();
  const updateUser = useUpdateUser();
  const toast = useToast();

  const { token } = (route.params ??
    {}) as Partial<EmailVerificationRouteParams>;

  const [verifyEmail] = useMutation(VerifyEmailDocument);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<
    'success' | 'error' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const performVerification = () => {
    performVerificationImpl(
      token,
      verifyEmail,
      user,
      updateUser,
      toast,
      setVerificationResult,
      setErrorMessage,
      setIsVerifying,
    );
  };

  useEffect(() => {
    performVerificationImpl(
      token,
      verifyEmail,
      user,
      updateUser,
      toast,
      setVerificationResult,
      setErrorMessage,
      setIsVerifying,
    );
  }, [token, verifyEmail, user, updateUser, toast]);

  const handleGoBack = () => {
    goBack();
  };

  return (
    <View style={styles.container}>
      <Header onClose={handleGoBack} />
      <View style={styles.content}>
        {!!isVerifying && (
          <>
            <SousChefLoader
              size="small"
              showBrand={false}
              message="Verifying your email..."
            />
            <Text
              size="md"
              tone="secondary"
              align="center"
              lineHeight="relaxed"
              style={styles.subtitle}
            >
              Please wait while we verify your email address.
            </Text>
          </>
        )}

        {verificationResult === 'success' && (
          <>
            <View style={styles.iconContainer}>
              <Icon name="checkmark-circle" size={64} tone="success" />
            </View>
            <Text
              size="xl"
              weight="semibold"
              align="center"
              style={styles.title}
            >
              Email Verified!
            </Text>
            <Text
              size="md"
              tone="secondary"
              align="center"
              lineHeight="relaxed"
              style={styles.subtitle}
            >
              Your email address has been successfully verified.
              {user?.onBoarded
                ? ' You can now access your account.'
                : ' Please complete your account setup.'}
            </Text>
          </>
        )}

        {verificationResult === 'error' && (
          <>
            <View style={styles.iconContainer}>
              <Icon name="close-circle-outline" size={64} tone="error" />
            </View>
            <Text
              size="xl"
              weight="semibold"
              align="center"
              style={styles.title}
            >
              Verification Failed
            </Text>
            <Text
              size="md"
              tone="secondary"
              align="center"
              lineHeight="relaxed"
              style={styles.subtitle}
            >
              {errorMessage}
            </Text>

            <View style={styles.actions}>
              <AppPressable
                style={styles.retryButton}
                onPress={performVerification}
              >
                <Text
                  size="md"
                  weight="semibold"
                  style={styles.retryButtonText}
                >
                  Try Again
                </Text>
              </AppPressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    marginTop: theme.spacing.md,
  },
  subtitle: {
    marginTop: theme.spacing['3'],
  },
  actions: {
    marginTop: theme.spacing.xl,
    width: '100%',
  },
  retryButton: {
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  retryButtonText: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
