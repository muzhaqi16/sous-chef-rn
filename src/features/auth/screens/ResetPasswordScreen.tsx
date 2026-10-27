import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { ThemedTextInputRef } from '#components/atoms/themedComponents';
import { useRoute } from '@react-navigation/native';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#components/atoms/Icon';
import { PasswordInput } from '#components/molecules/PasswordInput';
import { Button } from '#components/molecules/Button';
import { Loading } from '#components/molecules/Loading';
import { useStore } from '#store';
import { holdsSessionTokens } from '#store/slices/authSlice';
import { authService } from '#/services/authService';
import {
  useResetPassword,
  type ResetPasswordFn,
} from '#features/auth/hooks/useResetPassword';
import { logger } from '#/utils/environment';
import { localizedErrorMessage } from '#/services/errorService';
import { logValidationErrors } from '#/utils/validation/common';
import { resetPasswordSchema } from '#/utils/validation/auth';
import { useAuthNavigation } from '#features/auth/screens/useAuthNavigation';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { Screen } from '#components/templates/Screen';
import { toastService } from '#services/toastService';
import { authTestIDs } from '#features/auth/testIDs';

/** Module-level so the await chain does not bail the screen out of the compiler. */
async function performPasswordReset(
  token: string,
  newPassword: string,
  resetPassword: ResetPasswordFn,
  onCompleted: () => void,
  rejectedMessage: string,
  onTokenRejected: () => void,
  setNewPasswordError: (message: string) => void,
): Promise<void> {
  logger.info('Attempting password reset');

  const outcome = await resetPassword(token, newPassword);

  if (outcome.status === 'completed') {
    logger.info('Password reset successful');

    // The server ended every session of the account the link was for, which
    // may be this one, and nothing says whose it was. So a session held here
    // ends through the one sign-out, keeping this account's stored sign-in and
    // unsynced writes: resetting a password is not discarding them.
    if (holdsSessionTokens(useStore.getState())) {
      await authService.logout({
        keepBiometricCredentials: true,
        keepQueuedWrites: true,
      });
    }
    onCompleted();
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
  const { replaceWithLogin } = useAuthNavigation();
  const isLoggedOut = useIsLoggedOut();

  const { token } = (route.params ?? {}) as Partial<ResetPasswordRouteParams>;

  const { resetPassword, validateToken } = useResetPassword();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasValidTokenFormat = !!token && token.length >= 10;
  const [isTokenRejected, setIsTokenRejected] = useState(false);
  // 'checking' until the server has ruled on the token; 'done' once the reset
  // has gone through.
  const [stage, setStage] = useState<'checking' | 'form' | 'done'>('checking');

  const form = useForm<ResetPasswordForm>({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const watchedValues = useWatch({ control: form.control });

  // `shouldValidate` re-runs only THIS field's rule, and the match rule reports
  // on `confirmPassword`, so it is triggered once the confirmation has text: a
  // mismatch under an empty field is feedback on nothing the user did.
  const setField = (field: keyof ResetPasswordForm, value: string) => {
    form.setValue(field, value, { shouldValidate: true });
    if (field === 'newPassword' && form.getValues('confirmPassword') !== '') {
      void form.trigger('confirmPassword');
    }
  };

  // Any web page can present a link, and this one may be another account's, so
  // opening it leaves the session alone: only a completed reset ends it.
  useEffect(() => {
    // A missing or too-short token needs no server round trip — the render
    // below already shows the invalid-link view for it.
    if (!hasValidTokenFormat || !token) return;

    let cancelled = false;

    const check = async () => {
      // An unreachable server is NOT proof the link is good. Fail closed: show
      // the invalid-link view, let them try again.
      const accepted = await validateToken(token);
      if (cancelled) return;

      if (accepted) setStage('form');
      else setIsTokenRejected(true);
    };

    // `validateToken` settles a failure as `false`, so the check never rejects.
    void check();

    return () => {
      cancelled = true;
    };
  }, [token, hasValidTokenFormat, validateToken]);

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
          () => setStage('done'),
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

  if (stage === 'done') {
    return (
      <Screen
        testID={authTestIDs.resetPasswordDoneView}
        header={{ close: goBack }}
        scroll="none"
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="checkmark-circle-outline" size={64} tone="success" />
          </View>
          <Text role="subheading" align="center" style={styles.title}>
            {t('auth.resetPasswordDoneTitle')}
          </Text>
          <Text
            role="body"
            tone="secondary"
            align="center"
            style={styles.subtitle}
          >
            {t('auth.resetPasswordDoneBody')}
          </Text>

          <Button
            variant="primary"
            onPress={replaceWithLogin}
            style={styles.buttonSpacing}
            testID={authTestIDs.resetPasswordSignInButton}
          >
            {t('auth.signIn')}
          </Button>
        </View>
      </Screen>
    );
  }

  if (!hasValidTokenFormat || isTokenRejected) {
    return (
      <Screen
        testID={authTestIDs.resetPasswordInvalidLinkView}
        header={{ close: goBack }}
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

          {/* Signed in, there is no sign-in screen to return to. */}
          <Button
            variant="primary"
            onPress={isLoggedOut ? replaceWithLogin : goBack}
            style={styles.buttonSpacing}
          >
            {isLoggedOut ? t('auth.returnToLogin') : t('labels.goBack')}
          </Button>
        </View>
      </Screen>
    );
  }

  if (stage === 'checking') {
    return (
      <Screen
        testID={authTestIDs.resetPasswordCheckingView}
        header={{ close: goBack }}
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
      header={{ close: goBack }}
      scroll="form"
    >
      <View style={styles.formContent}>
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
        {isLoggedOut ? null : (
          <Text
            role="body"
            tone="secondary"
            align="center"
            style={styles.subtitle}
            testID={authTestIDs.resetPasswordSignsOutNote}
          >
            {t('auth.resetPasswordSignsOutNote')}
          </Text>
        )}

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
  // `flexGrow`, not `flex`: inside a scroller `flex: 1` pins the box to the
  // viewport, so taller content overflows instead of scrolling.
  formContent: {
    flexGrow: 1,
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
