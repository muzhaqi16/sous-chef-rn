import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#utils/iconUtils';
import { localizedErrorMessage } from '#/services/errorService';
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
 * A failure that names one of our fields is reported ON it: a toast covers the
 * form, and a dismissed toast cannot say which input it meant.
 */
function reportChangePassword(
  outcome: ChangePasswordOutcome,
  goBack: () => void,
  successMessage: string,
  setFieldError: (field: keyof ChangePasswordForm, message: string) => void,
): void {
  if (outcome.status === 'completed') {
    toastService.success(successMessage);
    setTimeout(() => {
      goBack();
    }, 1500);
    return;
  }

  const field = asFormField(outcome.field);
  if (field) {
    setFieldError(field, outcome.body);
    return;
  }
  toastService.error(outcome.body);
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
    void executeWithLoadingState(
      async () =>
        reportChangePassword(
          await changePassword({
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
          }),
          goBack,
          t('changePassword.success'),
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

  // `shouldValidate` re-runs the rule on THIS field only, and both cross-field
  // rules report elsewhere: the match rule on `confirmPassword`, the
  // must-differ rule on `newPassword`. Those re-run only for a sibling the
  // user has reached — a "required" under a field they have not typed in is
  // feedback on nothing they did. Submit still waits on whole-schema `isValid`.
  const setField = (field: keyof ChangePasswordForm, value: string) => {
    form.setValue(field, value, { shouldValidate: true });
    if (field !== 'newPassword' && form.getValues('newPassword') !== '') {
      void form.trigger('newPassword');
    }
    if (
      field !== 'confirmPassword' &&
      form.getValues('confirmPassword') !== ''
    ) {
      void form.trigger('confirmPassword');
    }
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
              onChangeText={text => setField('currentPassword', text)}
              placeholder={t('changePassword.currentPasswordPlaceholder')}
              errorMessage={form.formState.errors.currentPassword?.message}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.field}>
            <Text role="bodyStrong" style={styles.label}>
              {t('auth.newPassword')}
            </Text>
            <PasswordInput
              value={watchedValues.newPassword}
              onChangeText={text => setField('newPassword', text)}
              placeholder={t('auth.newPasswordPlaceholder')}
              errorMessage={form.formState.errors.newPassword?.message}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.field}>
            <Text role="bodyStrong" style={styles.label}>
              {t('changePassword.confirmPassword')}
            </Text>
            <PasswordInput
              value={watchedValues.confirmPassword}
              onChangeText={text => setField('confirmPassword', text)}
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
    marginBottom: theme.spacing.sm,
  },
  buttonSpacing: {
    marginTop: theme.spacing.md,
  },
}));

export default ChangePasswordScreen;
