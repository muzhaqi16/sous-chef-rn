import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#utils/iconUtils';
import { localizedErrorMessage } from '#/services/errorService';
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';
import { PasswordInput } from '#components/molecules/PasswordInput';
import { Button } from '#components/molecules/Button';
import {
  useChangePassword,
  type ChangePasswordOutcome,
} from '#features/profile/hooks/useChangePassword';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { changePasswordSchema } from '#utils/validation/auth';
import { logValidationErrors } from '#utils/validation/common';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Screen } from '#components/templates/Screen';
import { toastService } from '#services/toastService';

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** The refused field as a form field, when the server named one of ours. */
const asFormField = (
  field: string | null | undefined,
): keyof ChangePasswordForm | undefined => {
  const name = field?.split('.').pop();
  if (
    name === 'currentPassword' ||
    name === 'newPassword' ||
    name === 'confirmPassword'
  ) {
    return name;
  }
  return undefined;
};

/**
 * Module-level so the throw does not bail the screen out of the React Compiler.
 * A failure that names one of our fields is reported ON it: a toast covers the
 * form, and a dismissed toast cannot say which input it meant.
 */
async function reportChangePassword(
  outcome: ChangePasswordOutcome,
  goBack: () => void,
  successMessage: string,
  failedFallback: string,
  setFieldError: (field: keyof ChangePasswordForm, message: string) => void,
): Promise<void> {
  if (outcome.status === 'rateLimited') {
    toastService.error(outcome.localizedMessage);
    return;
  }

  if (outcome.status === 'completed') {
    toastService.success(successMessage);
    setTimeout(() => {
      goBack();
    }, 1500);
    return;
  }

  // Never `payload.message`: the server's prose is unlocalizable English by
  // construction. A ValidationError names the field it refused.
  const payload = outcome.payload;
  const message = localizedRefusalMessage(payload, failedFallback);
  const field =
    payload?.__typename === 'ValidationError'
      ? asFormField(payload.field)
      : undefined;

  if (field) {
    setFieldError(field, message);
    return;
  }
  throw new Error(message);
}

export const ChangePasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { changePassword } = useChangePassword();

  const form = useForm<ChangePasswordForm>({
    resolver: yupResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const watchedValues = useWatch({ control: form.control });

  const onSubmit = (data: ChangePasswordForm) => {
    executeWithLoadingState(
      async () =>
        reportChangePassword(
          await changePassword({
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
          }),
          goBack,
          t('changePassword.success'),
          t('changePassword.failed'),
          (field, message) => form.setError(field, { message }),
        ),
      setIsSubmitting,
      (error: unknown) => {
        const errorMessage = localizedErrorMessage(
          error,
          t('changePassword.failedFallback'),
        );
        toastService.error(errorMessage);
      },
    );
  };

  const isFormValid = form.formState.isValid;

  return (
    <Screen
      header={{
        title: t('labels.changePassword'),
        back: goBack,
        centerTitle: true,
      }}
      scroll="form"
      gutter="none"
    >
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Icon name="lock-closed-outline" size={64} tone="primary" />
        </View>

        <Text role="body" style={styles.subtitle}>
          {t('changePassword.subtitle')}
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text role="bodyStrong" style={styles.label}>
              {t('changePassword.currentPassword')}
            </Text>
            <PasswordInput
              value={watchedValues.currentPassword}
              onChangeText={text =>
                form.setValue('currentPassword', text, {
                  shouldValidate: true,
                })
              }
              placeholder={t('changePassword.currentPasswordPlaceholder')}
              errorMessage={form.formState.errors.currentPassword?.message}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.newPassword')}</Text>
            <PasswordInput
              value={watchedValues.newPassword}
              onChangeText={text =>
                form.setValue('newPassword', text, { shouldValidate: true })
              }
              placeholder={t('auth.newPasswordPlaceholder')}
              errorMessage={form.formState.errors.newPassword?.message}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              {t('changePassword.confirmPassword')}
            </Text>
            <PasswordInput
              value={watchedValues.confirmPassword}
              onChangeText={text =>
                form.setValue('confirmPassword', text, {
                  shouldValidate: true,
                })
              }
              placeholder={t('auth.confirmPasswordPlaceholder')}
              errorMessage={form.formState.errors.confirmPassword?.message}
              editable={!isSubmitting}
            />
          </View>

          <Button
            variant="primary"
            onPress={form.handleSubmit(onSubmit, logValidationErrors)}
            disabled={!isFormValid}
            loading={isSubmitting}
            style={styles.buttonSpacing}
          >
            {t('labels.changePassword')}
          </Button>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  buttonSpacing: {
    marginTop: theme.spacing.md,
  },
}));

export default ChangePasswordScreen;
