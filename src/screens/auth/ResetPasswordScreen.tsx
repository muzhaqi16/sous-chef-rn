import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { object, string, ref } from 'yup';
import { Icon } from '#utils';
import { PasswordInput } from '#components/atoms';
import { useAuth } from '#hooks/auth/useAuth';
import { useResetPasswordMutation } from '#generated';
import { logger } from '#/utils/environment';
import { useToast } from '#/hooks/useToast';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';

interface ResetPasswordRouteParams {
  token: string;
}

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

const resetPasswordSchema = object().shape({
  newPassword: string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: string()
    .required('Please confirm your password')
    .oneOf([ref('newPassword')], 'Passwords must match'),
});

export const ResetPasswordScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useUnistyles();
  const { clearAuth } = useAuth();
  const { navigateToLogin } = useAuthNavigation();
  const toast = useToast();

  const { token } = route.params as ResetPasswordRouteParams;

  const [resetPassword] = useResetPasswordMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(true);

  const form = useForm<ResetPasswordForm>({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Clear any existing auth state when entering password reset
    clearAuth();

    // Validate token format (basic check)
    if (!token || token.length < 10) {
      setIsTokenValid(false);
    }
  }, [token, clearAuth]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      toast({
        message: 'Invalid reset token',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      logger.info('Attempting password reset', {
        tokenPrefix: token.substring(0, 8) + '...'
      });

      const result = await resetPassword({
        variables: {
          token,
          newPassword: data.newPassword,
        },
      });

      if (result.data?.resetPassword?.success) {
        logger.info('Password reset successful');

        toast({
          message: 'Password reset successfully! Please sign in with your new password.',
          type: 'success',
        });

        // Navigate to login screen after a short delay
        setTimeout(() => {
          navigateToLogin();
        }, 1500);

      } else {
        throw new Error(result.data?.resetPassword?.message || 'Password reset failed');
      }
    } catch (error: any) {
      logger.error('Password reset failed', { error });

      const errorMessage = error.message || 'Failed to reset password. The link may be expired or invalid.';

      toast({
        message: errorMessage,
        type: 'error',
      });

      // If token is invalid/expired, show token error state
      if (errorMessage.toLowerCase().includes('expired') || errorMessage.toLowerCase().includes('invalid')) {
        setIsTokenValid(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleReturnToLogin = () => {
    navigateToLogin();
  };

  if (!isTokenValid) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack}>
            <Icon name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="x-circle" size={64} color={theme.colors.error} />
          </View>
          <Text style={styles.title}>Invalid Reset Link</Text>
          <Text style={styles.subtitle}>
            This password reset link is invalid or has expired.
            Please request a new password reset from the login screen.
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleReturnToLogin}>
            <Text style={styles.primaryButtonText}>Return to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack}>
          <Icon name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="lock" size={64} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>Reset Your Password</Text>
        <Text style={styles.subtitle}>
          Enter your new password below. Make sure it's secure and easy for you to remember.
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>New Password</Text>
            <PasswordInput
              value={form.watch('newPassword')}
              onChangeText={(text) => form.setValue('newPassword', text)}
              placeholder="Enter your new password"
              errorMessage={form.formState.errors.newPassword?.message}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <PasswordInput
              value={form.watch('confirmPassword')}
              onChangeText={(text) => form.setValue('confirmPassword', text)}
              placeholder="Confirm your new password"
              errorMessage={form.formState.errors.confirmPassword?.message}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={form.handleSubmit(onSubmit)}
            disabled={isSubmitting || !form.formState.isValid}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>Reset Password</Text>
            )}
          </TouchableOpacity>
        </View>
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
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing['3'],
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.xl,
  },
  form: {
    width: '100%',
    maxWidth: 320,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  button: {
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    marginTop: theme.spacing['3'],
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
}));