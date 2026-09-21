import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { ThemedTextInputRef } from '#components/atoms/themedComponents';
import { useRoute } from '@react-navigation/native';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#utils/iconUtils';
import { PasswordInput } from '#components/molecules/PasswordInput';
import { Button } from '#components/molecules/Button';
import { Loading } from '#components/molecules/Loading';
import { useAppStore } from '#store/useAppStore';
import {
  useResetPassword,
  type ResetPasswordFn,
} from '#features/auth/hooks/useResetPassword';
import { logger } from '#/utils/environment';
import { localizedErrorMessage } from '#/services/errorService';
import { logValidationErrors } from '#/utils/validation/common';
import { getResetPasswordValidationSchema } from '#/utils/validation/auth';
import { useAuthNavigation } from '#features/auth/hooks/useAuthNavigation';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Screen } from '#components/templates/Screen';
import { toastService } from '#services/toastService';
import { authTestIDs } from '#features/auth/testIDs';

/** Module-level so the await chain does not bail the screen out of the compiler. */
async function performPasswordReset(
  token: string,
  newPassword: string,
  resetPassword: ResetPasswordFn,
  navigateToLogin: () => void,
  successMessage: string,
  rejectedMessage: string,
  onTokenRejected: () => void,
  setNewPasswordError: (message: string) => void,
): Promise<void> {
  logger.info('Attempting password reset');

  const outcome = await resetPassword(token, newPassword);

  if (outcome.status === 'completed') {
    logger.info('Password reset successful');

    toastService.success(successMessage);

    setTimeout(() => {
      navigateToLogin();
    }, 1500);
    return;
  }

  // The form can never succeed with a spent link, and leaving the user on it
  // invites them to keep retrying — so the screen switches to the invalid view.
  if (outcome.status === 'linkRejected') {
    onTokenRejected();
    toastService.error(rejectedMessage);
    return;
  }

  // A password the server refuses is a field the user can fix, so the message
  // belongs on the input rather than in a toast that says nothing about which.
  if (outcome.field === 'newPassword') {
    setNewPasswordError(outcome.body);
    return;
  }

  toastService.error(outcome.body);
}

interface ResetPasswordRouteParams {
  token: string;
}

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
}

export const ResetPasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const route = useRoute();
  const { goBack } = useAppNavigation();
  const clearAuth = useAppStore(state => state.clearAuth);
  const { navigateToLogin } = useAuthNavigation();

  const { token } = (route.params ?? {}) as Partial<ResetPasswordRouteParams>;

  const { resetPassword, validateToken } = useResetPassword();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasValidTokenFormat = !!token && token.length >= 10;
  const [isTokenRejected, setIsTokenRejected] = useState(false);
  // 'checking' until the server has ruled on the token. Nothing
  // session-affecting happens before it leaves that state.
  const [tokenCheck, setTokenCheck] = useState<'checking' | 'valid'>(
    'checking',
  );

  const form = useForm<ResetPasswordForm>({
    resolver: yupResolver(getResetPasswordValidationSchema()),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const watchedValues = useWatch({ control: form.control });

  // `shouldValidate` re-runs the rule on THIS field only, and the match rule
  // reports on `confirmPassword` while reading `newPassword`. It re-runs only
  // once the confirmation has been reached — a mismatch under an empty field
  // is feedback on nothing the user did. Submit still waits on `isValid`.
  const setField = (field: keyof ResetPasswordForm, value: string) => {
    form.setValue(field, value, { shouldValidate: true });
    if (field === 'newPassword' && form.getValues('confirmPassword') !== '') {
      void form.trigger('confirmPassword');
    }
  };

  // Opening a link must not, by itself, end a session — any web page can
  // present one. So the token is checked against the server FIRST, and only a
  // token the server accepts clears the current session (which the reset then
  // requires). A missing, malformed, expired or unverifiable token leaves the
  // session untouched and shows the invalid-link view.
  useEffect(() => {
    // A missing or too-short token needs no server round trip — the render
    // below already shows the invalid-link view for it, so this effect simply
    // never runs and the session is never touched.
    if (!hasValidTokenFormat || !token) return;

    let cancelled = false;

    const check = async () => {
      // An unreachable server is NOT proof the link is good. Fail closed: keep
      // the session, show the invalid-link view, let them try again.
      const accepted = await validateToken(token);
      if (cancelled) return;

      if (!accepted) {
        setIsTokenRejected(true);
        return;
      }

      // Only now: the link is genuine, and completing the reset requires the
      // old session to be gone.
      clearAuth();
      setTokenCheck('valid');
    };

    // `validateToken` settles a failure as `false`, so the check never rejects.
    void check();

    return () => {
      cancelled = true;
    };
  }, [token, hasValidTokenFormat, validateToken, clearAuth]);

  const handleTokenRejected = () => {
    setIsTokenRejected(true);
  };

  const onSubmit = (data: ResetPasswordForm) => {
    if (!token) {
      toastService.error(t('auth.invalidResetToken'));
      return;
    }

    void executeWithLoadingState(
      () =>
        performPasswordReset(
          token,
          data.newPassword,
          resetPassword,
          navigateToLogin,
          t('auth.resetPasswordSuccess'),
          t('auth.resetPasswordFailedFallback'),
          handleTokenRejected,
          message => form.setError('newPassword', { message }),
        ),
      setIsSubmitting,
      (error: unknown) => {
        logger.error('Password reset failed', { error });
        toastService.error(
          localizedErrorMessage(error, t('auth.resetPasswordFailedFallback')),
        );
      },
    );
  };

  // Focus can only be moved imperatively in React Native, so the "next" key on
  // the first field needs a handle on the second one.
  const confirmPasswordRef = useRef<ThemedTextInputRef>(null);

  const focusConfirmPassword = () => {
    confirmPasswordRef.current?.focus();
  };

  const handleGoBack = () => {
    goBack();
  };

  const handleReturnToLogin = () => {
    navigateToLogin();
  };

  if (!hasValidTokenFormat || isTokenRejected) {
    return (
      <Screen
        testID={authTestIDs.resetPasswordInvalidLinkView}
        header={{
          close: handleGoBack,
        }}
        scroll="none"
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="close-circle-outline" size={64} tone="error" />
          </View>
          <Text role="subheading" align="center" style={styles.title}>
            {t('auth.invalidResetLinkTitle')}
          </Text>
          <Text
            role="body"
            tone="secondary"
            align="center"
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
      </Screen>
    );
  }

  if (tokenCheck === 'checking') {
    return (
      <Screen
        testID={authTestIDs.resetPasswordCheckingView}
        header={{
          close: handleGoBack,
        }}
        scroll="none"
      >
        <View style={styles.content}>
          <Loading />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      testID={authTestIDs.resetPasswordScreen}
      header={{
        close: handleGoBack,
      }}
      scroll="form"
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="lock-closed-outline" size={64} tone="primary" />
        </View>

        <Text role="subheading" align="center" style={styles.title}>
          {t('auth.resetPasswordTitle')}
        </Text>
        <Text
          role="body"
          tone="secondary"
          align="center"
          style={styles.subtitle}
        >
          {t('auth.resetPasswordSubtitle')}
        </Text>

        {/* The inputs write through setValue rather than register/Controller,
            so `shouldValidate` is what keeps formState.isValid — and with it
            the submit button — in step with what the user has typed. */}
        <View style={styles.form}>
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
              testID={authTestIDs.resetPasswordNewInput}
              returnKeyType="next"
              // Hand focus straight to the confirmation without letting the
              // keyboard drop and re-open in between.
              submitBehavior="submit"
              onSubmitEditing={focusConfirmPassword}
            />
          </View>

          <View style={styles.field}>
            <Text role="bodyStrong" style={styles.label}>
              {t('auth.confirmPassword')}
            </Text>
            <PasswordInput
              ref={confirmPasswordRef}
              returnKeyType="done"
              value={watchedValues.confirmPassword}
              onChangeText={text => setField('confirmPassword', text)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              errorMessage={form.formState.errors.confirmPassword?.message}
              editable={!isSubmitting}
              testID={authTestIDs.resetPasswordConfirmInput}
            />
          </View>

          <Button
            variant="primary"
            onPress={form.handleSubmit(onSubmit, logValidationErrors)}
            disabled={!form.formState.isValid}
            loading={isSubmitting}
            style={styles.buttonSpacing}
            testID={authTestIDs.resetPasswordSubmitButton}
          >
            {t('auth.resetPasswordButton')}
          </Button>
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    marginBottom: theme.spacing.base,
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
    marginTop: theme.spacing.base,
  },
}));
