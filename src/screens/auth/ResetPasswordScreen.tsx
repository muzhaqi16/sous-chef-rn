import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { object, string, ref } from 'yup';
import { Icon } from '#utils/iconUtils';
import { Header } from '#components/molecules/Header';
import { PasswordInput } from '#components/atoms/PasswordInput';
import { Button } from '#components/base/Button';
import { useAppStore } from '#store/useAppStore';
import { useMutation } from '@apollo/client/react';
import {
  ResetPasswordDocument,
  type ResetPasswordMutation,
  type ResetPasswordMutationVariables,
} from '#operations/auth/auth.generated';
import { PasswordActionStatus } from '#/graphql/generated/schemaTypes';
import { logger } from '#/utils/environment';
import { errorMessageOr } from '#/services/errorService';
import { logValidationErrors } from '#/utils/validation/common';
import { useToast } from '#/hooks/useToast';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import type { ToastFn } from '#/components/atoms/Toast';
import { Text } from '#components/atoms/Text';

/** Module-level async function for password reset submission.
 *  Extracted from component body to avoid ThrowStatement-in-try-catch bailout. */
type ResetPasswordFn = useMutation.MutationFunction<
  ResetPasswordMutation,
  ResetPasswordMutationVariables
>;

async function performPasswordReset(
  token: string,
  newPassword: string,
  resetPassword: ResetPasswordFn,
  toast: ToastFn,
  navigateToLogin: () => void,
  successMessage: string,
  defaultErrorMessage: string,
): Promise<void> {
  logger.info('Attempting password reset', {
    tokenPrefix: token.substring(0, 8) + '...',
  });

  const result = await resetPassword({
    variables: { input: { token, newPassword } },
  });

  const payload = result.data?.resetPassword;

  if (
    payload?.__typename === 'ResetPasswordPayload' &&
    payload.status === PasswordActionStatus.Completed
  ) {
    logger.info('Password reset successful');

    toast({
      message: successMessage,
      type: 'success',
    });

    setTimeout(() => {
      navigateToLogin();
    }, 1500);
  } else if (payload?.__typename === 'ResetPasswordPayload') {
    throw new Error(defaultErrorMessage);
  } else {
    throw new Error(payload?.message || defaultErrorMessage);
  }
}

interface ResetPasswordRouteParams {
  token: string;
}

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

type T = (key: string) => string;

const getResetPasswordSchema = (t: T) =>
  object().shape({
    newPassword: string()
      .required(t('auth.passwordRequired'))
      .min(8, t('auth.passwordTooShort'))
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, t('auth.passwordComplexity')),
    confirmPassword: string()
      .required(t('auth.passwordConfirmRequired'))
      .oneOf([ref('newPassword')], t('auth.passwordsMustMatch')),
  });

export const ResetPasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute();
  const { goBack } = useNavigation();
  const clearAuth = useAppStore(state => state.clearAuth);
  const { navigateToLogin } = useAuthNavigation();
  const toast = useToast();

  const { token } = (route.params ?? {}) as Partial<ResetPasswordRouteParams>;

  const [resetPassword] = useMutation(ResetPasswordDocument);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasValidTokenFormat = !!token && token.length >= 10;
  const [isTokenRejected, setIsTokenRejected] = useState(false);

  const form = useForm<ResetPasswordForm>({
    resolver: yupResolver(getResetPasswordSchema(t)),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const watchedValues = useWatch({ control: form.control });

  useEffect(() => {
    // Clear any existing auth state when entering password reset
    clearAuth();
  }, [token, clearAuth]);

  const onSubmit = (data: ResetPasswordForm) => {
    if (!token) {
      toast({
        message: t('auth.invalidResetToken'),
        type: 'error',
      });
      return;
    }

    executeWithLoadingState(
      () =>
        performPasswordReset(
          token,
          data.newPassword,
          resetPassword,
          toast,
          navigateToLogin,
          t('auth.resetPasswordSuccess'),
          t('errors.resetPasswordFailed'),
        ),
      setIsSubmitting,
      (error: unknown) => {
        logger.error('Password reset failed', { error });

        const errorMessage = errorMessageOr(
          error,
          t('auth.resetPasswordFailedFallback'),
        );

        toast({
          message: errorMessage,
          type: 'error',
        });

        if (
          errorMessage.toLowerCase().includes('expired') ||
          errorMessage.toLowerCase().includes('invalid')
        ) {
          setIsTokenRejected(true);
        }
      },
    );
  };

  const handleGoBack = () => {
    goBack();
  };

  const handleReturnToLogin = () => {
    navigateToLogin();
  };

  if (!hasValidTokenFormat || isTokenRejected) {
    return (
      <View style={styles.container}>
        <Header onClose={handleGoBack} />

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="close-circle-outline" size={64} tone="error" />
          </View>
          <Text size="xl" weight="semibold" align="center" style={styles.title}>
            {t('auth.invalidResetLinkTitle')}
          </Text>
          <Text
            size="md"
            tone="secondary"
            align="center"
            lineHeight="relaxed"
            style={styles.subtitle}
          >
            {t('auth.invalidResetLinkSubtitle')}
          </Text>

          <Button
            variant="primary"
            onPress={handleReturnToLogin}
            style={styles.buttonSpacing}
          >
            {t('auth.returnToLogin')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onClose={handleGoBack} />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="lock-closed-outline" size={64} tone="primary" />
        </View>

        <Text size="xl" weight="semibold" align="center" style={styles.title}>
          {t('auth.resetPasswordTitle')}
        </Text>
        <Text
          size="md"
          tone="secondary"
          align="center"
          lineHeight="relaxed"
          style={styles.subtitle}
        >
          {t('auth.resetPasswordSubtitle')}
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text size="md" weight="medium" style={styles.label}>
              {t('auth.newPassword')}
            </Text>
            <PasswordInput
              value={watchedValues.newPassword}
              onChangeText={text => form.setValue('newPassword', text)}
              placeholder={t('auth.newPasswordPlaceholder')}
              errorMessage={form.formState.errors.newPassword?.message}
            />
          </View>

          <View style={styles.field}>
            <Text size="md" weight="medium" style={styles.label}>
              {t('auth.confirmPassword')}
            </Text>
            <PasswordInput
              value={watchedValues.confirmPassword}
              onChangeText={text => form.setValue('confirmPassword', text)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              errorMessage={form.formState.errors.confirmPassword?.message}
            />
          </View>

          <Button
            variant="primary"
            onPress={form.handleSubmit(onSubmit, logValidationErrors)}
            disabled={!form.formState.isValid}
            loading={isSubmitting}
            style={styles.buttonSpacing}
          >
            {t('auth.resetPasswordButton')}
          </Button>
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
    marginBottom: theme.spacing['3'],
  },
  subtitle: {
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
    marginBottom: theme.spacing.sm,
  },
  buttonSpacing: {
    marginTop: theme.spacing['3'],
  },
}));
