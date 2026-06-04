import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text } from '#components/atoms/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Icon } from '#utils/iconUtils';
import { errorMessageOr } from '#/services/errorService';
import { PasswordInput } from '#components/atoms/PasswordInput';
import { Header } from '#components/molecules/Header';
import { Button } from '#components/base/Button';
import { useMutation } from '@apollo/client/react';
import {
  ChangePasswordDocument,
  type ChangePasswordMutation,
  type ChangePasswordMutationVariables,
} from '#operations/auth/auth.generated';
import { useToast } from '#hooks/useToast';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { changePasswordSchema } from '#utils/validation/auth';
import { logValidationErrors } from '#utils/validation/common';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Module-level async function to handle password change mutation.
 *  Extracted to avoid try-catch/throw inside component body (React Compiler bailout). */
async function performChangePassword(
  changePassword: useMutation.MutationFunction<
    ChangePasswordMutation,
    ChangePasswordMutationVariables
  >,
  data: ChangePasswordForm,
  toast: ReturnType<typeof useToast>,
  goBack: () => void,
  successMessage: string,
  failedFallback: string,
): Promise<void> {
  const result = await changePassword({
    variables: {
      input: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
    },
  });

  if (result.data?.changePassword?.success) {
    toast({
      message: successMessage,
      type: 'success',
    });

    setTimeout(() => {
      goBack();
    }, 1500);
  } else {
    throw new Error(result.data?.changePassword?.message || failedFallback);
  }
}

export const ChangePasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [changePassword] = useMutation(ChangePasswordDocument);

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
      () =>
        performChangePassword(
          changePassword,
          data,
          toast,
          goBack,
          t('changePassword.success'),
          t('changePassword.failed'),
        ),
      setIsSubmitting,
      (error: unknown) => {
        const errorMessage = errorMessageOr(
          error,
          t('changePassword.failedFallback'),
        );
        toast({
          message: errorMessage,
          type: 'error',
        });
      },
    );
  };

  const isFormValid = form.formState.isValid;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <Header title={t('changePassword.title')} onBack={goBack} centerTitle />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Icon name="lock-closed-outline" size={64} tone="primary" />
          </View>

          <Text style={styles.subtitle}>{t('changePassword.subtitle')}</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>
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
              <Text style={styles.label}>
                {t('changePassword.newPassword')}
              </Text>
              <PasswordInput
                value={watchedValues.newPassword}
                onChangeText={text =>
                  form.setValue('newPassword', text, { shouldValidate: true })
                }
                placeholder={t('changePassword.newPasswordPlaceholder')}
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
                placeholder={t('changePassword.confirmPasswordPlaceholder')}
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
              {t('changePassword.submit')}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.fonts.size.md * 1.5,
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  buttonSpacing: {
    marginTop: theme.spacing.md,
  },
}));

export default ChangePasswordScreen;
