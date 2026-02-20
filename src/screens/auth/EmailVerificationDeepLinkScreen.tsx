import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { useAuth } from '#hooks/auth/useAuth';
import { useVerifyEmailMutation } from '#generated';
import { logger } from '#/utils/environment';
import { useToast } from '#/hooks/useToast';

interface EmailVerificationRouteParams {
  token: string;
}

export const EmailVerificationDeepLinkScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useUnistyles();
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const { token } = (route.params ?? {}) as Partial<EmailVerificationRouteParams>;

  const [verifyEmail] = useVerifyEmailMutation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setVerificationResult('error');
        setErrorMessage('Invalid verification token');
        setIsVerifying(false);
        return;
      }

      try {
        logger.info('Attempting email verification', {
          tokenPrefix: token.substring(0, 8) + '...',
          userId: user?.id
        });

        const result = await verifyEmail({
          variables: { code: token }
        });

        if (result.data?.verifyEmail?.success) {
          logger.info('Email verification successful');

          // Update user state to mark email as verified
          if (user) {
            updateUser({ ...user, emailVerified: true });
          }

          setVerificationResult('success');

          toast({
            message: 'Email verified successfully!',
            type: 'success',
          });

          // Navigation will be handled automatically by the navigation state machine
          // when user.emailVerified changes to true

        } else {
          throw new Error(result.data?.verifyEmail?.message || 'Verification failed');
        }
      } catch (error: any) {
        logger.error('Email verification failed', { error });

        const errorMsg = error.message || 'Verification failed. The link may be expired or invalid.';
        setErrorMessage(errorMsg);
        setVerificationResult('error');

        toast({
          message: errorMsg,
          type: 'error',
        });
      } finally {
        setIsVerifying(false);
      }
    };

    performVerification();
  }, [token, verifyEmail, user, updateUser, toast]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleRetry = () => {
    if (!token) return;

    setIsVerifying(true);
    setVerificationResult(null);
    setErrorMessage('');

    // Retry verification
    const performVerification = async () => {
      try {
        const result = await verifyEmail({
          variables: { code: token }
        });

        if (result.data?.verifyEmail?.success) {
          if (user) {
            updateUser({ ...user, emailVerified: true });
          }
          setVerificationResult('success');
          toast({
            message: 'Email verified successfully!',
            type: 'success',
          });
        } else {
          throw new Error(result.data?.verifyEmail?.message || 'Verification failed');
        }
      } catch (error: any) {
        const errorMsg = error.message || 'Verification failed. The link may be expired or invalid.';
        setErrorMessage(errorMsg);
        setVerificationResult('error');
        toast({
          message: errorMsg,
          type: 'error',
        });
      } finally {
        setIsVerifying(false);
      }
    };

    performVerification();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={({pressed}) => pressed && styles.pressed} onPress={handleGoBack}>
          <Icon name="close" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {isVerifying && (
          <>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.title}>Verifying your email...</Text>
            <Text style={styles.subtitle}>Please wait while we verify your email address.</Text>
          </>
        )}

        {verificationResult === 'success' && (
          <>
            <View style={styles.iconContainer}>
              <Icon name="checkmark-circle" size={64} color={theme.colors.success} />
            </View>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.subtitle}>
              Your email address has been successfully verified.
              {user?.onBoarded
                ? ' You can now access your account.'
                : ' Please complete your account setup.'
              }
            </Text>
          </>
        )}

        {verificationResult === 'error' && (
          <>
            <View style={styles.iconContainer}>
              <Icon name="close-circle-outline" size={64} color={theme.colors.error} />
            </View>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>

            <View style={styles.actions}>
              <Pressable
                style={({pressed}) => [styles.button, styles.retryButton, pressed && styles.pressed]}
                onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing['3'],
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  actions: {
    marginTop: theme.spacing.xl,
    width: '100%',
  },
  button: {
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));