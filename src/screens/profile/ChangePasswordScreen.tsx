import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { PasswordInput } from '#components/atoms/PasswordInput';
import { Header } from '#components/molecules/Header';
import { useChangePasswordMutation } from '#generated';
import { useToast } from '#hooks/useToast';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { changePasswordSchema } from '#utils/validation/auth';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Module-level async function to handle password change mutation.
 *  Extracted to avoid try-catch/throw inside component body (React Compiler bailout). */
async function performChangePassword(
  changePassword: ReturnType<typeof useChangePasswordMutation>[0],
  data: ChangePasswordForm,
  toast: ReturnType<typeof useToast>,
  goBack: () => void,
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
      message: 'Password changed successfully!',
      type: 'success',
    });

    setTimeout(() => {
      goBack();
    }, 1500);
  } else {
    throw new Error(
      result.data?.changePassword?.message || 'Failed to change password',
    );
  }
}

export const ChangePasswordScreen: React.FC = () => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [changePassword] = useChangePasswordMutation();

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
      () => performChangePassword(changePassword, data, toast, goBack),
      setIsSubmitting,
      (error: unknown) => {
        const errorMessage =
          (error as any)?.message || 'Failed to change password. Please try again.';
        toast({
          message: errorMessage,
          type: 'error',
        });
      },
    );
  };

  const isFormValid = form.formState.isValid;

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Change Password" onBack={goBack} centerTitle />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Icon name="lock-closed-outline" size={64} color={theme.colors.primary} />
          </View>

          <Text style={styles.subtitle}>
            Enter your current password and choose a new secure password.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Current Password</Text>
              <PasswordInput
                value={watchedValues.currentPassword}
                onChangeText={text =>
                  form.setValue('currentPassword', text, { shouldValidate: true })
                }
                placeholder="Enter your current password"
                errorMessage={form.formState.errors.currentPassword?.message}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>New Password</Text>
              <PasswordInput
                value={watchedValues.newPassword}
                onChangeText={text =>
                  form.setValue('newPassword', text, { shouldValidate: true })
                }
                placeholder="Enter your new password"
                errorMessage={form.formState.errors.newPassword?.message}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirm New Password</Text>
              <PasswordInput
                value={watchedValues.confirmPassword}
                onChangeText={text =>
                  form.setValue('confirmPassword', text, { shouldValidate: true })
                }
                placeholder="Confirm your new password"
                errorMessage={form.formState.errors.confirmPassword?.message}
                editable={!isSubmitting}
              />
            </View>

            <Pressable
              style={({pressed}) => [
                styles.submitButton,
                (!isFormValid || isSubmitting) && styles.submitButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={form.handleSubmit(onSubmit)}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Change Password</Text>
              )}
            </Pressable>
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
  submitButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  submitButtonDisabled: {
    opacity: theme.opacity.disabled,
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default ChangePasswordScreen;
