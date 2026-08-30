import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '#/i18n';

import { AuthFormTemplate } from '#components/templates/AuthFormTemplate';
import { AuthWrapper } from '#components/templates/AuthWrapper';
import { CodeVerificationScreen } from '#screens/auth/CodeVerificationScreen';
import { EmailInput } from '#components/atoms/EmailInput';
import { PasswordInput } from '#components/atoms/PasswordInput';
import { NameInput } from '#components/atoms/NameInput';
import { getSignUpValidationSchema } from '#/utils/validation/auth';
import { logValidationErrors } from '#/utils/validation/common';
import { type RegisterInput } from '#/graphql/generated/schemaTypes';
import { authService } from '#/services/authService';
import { useAppStore } from '#store/useAppStore';
import { useAuthNavigation } from '#hooks/navigation/useAuthNavigation';

type SignUpValues = RegisterInput & { confirmPassword: string; name: string };

export const SignUpScreen = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { goBack } = useNavigation();
  const isRegistering = useAppStore(state => state.authIsLoading);
  const { navigateToLogin } = useAuthNavigation();

  // Registration is verification-first: a successful `register` sends an
  // activation mail and opens NO session. On success we swap the form for the
  // code-entry screen (same for a new or already-registered email —
  // existence-blind) instead of navigating into the app.
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: yupResolver(getSignUpValidationSchema()),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignUpValues) => {
    const { name, email, password } = data;
    const input: RegisterInput = { name, email, password };

    // Uses default rememberMe=true
    let ok;
    try {
      ok = await authService.register(input);
    } catch (err) {
      authService.handleAuthError(err, 'Registration');
    }

    if (ok) {
      setSentToEmail(email);
    }
  };

  // The activation mail carries BOTH a 6-digit code and a link, and
  // `verifyEmail` is public — it takes either one and needs no session. So the
  // confirmation offers the code straight away rather than sending the user out
  // to their mail client and back; the link still works untouched.
  if (sentToEmail !== null) {
    return <CodeVerificationScreen context="signup" email={sentToEmail} />;
  }

  return (
    <AuthWrapper testID="signup-screen">
      <AuthFormTemplate<SignUpValues>
        title={t('auth.signupTitle')}
        subtitle={t('auth.signupSubtitle')}
        onBackPress={() => goBack()}
        fields={[
          {
            name: 'name',
            label: t('auth.name'),
            placeholder: t('auth.namePlaceholder'),
            component: NameInput,
            props: { testID: 'signup-name-input' },
          },
          {
            name: 'email',
            label: t('auth.emailAddress'),
            component: EmailInput,
            props: { testID: 'signup-email-input' },
          },
          {
            name: 'password',
            label: t('auth.password'),
            component: PasswordInput,
            props: { testID: 'signup-password-input' },
          },
          {
            name: 'confirmPassword',
            label: t('auth.confirmPassword'),
            component: PasswordInput,
            props: { testID: 'signup-confirm-password-input' },
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        focusChaining
        submitText={
          isRegistering ? t('auth.creatingAccount') : t('auth.signUp')
        }
        submitButtonTestID="signup-submit-button"
        onSubmit={form.handleSubmit(onSubmit, logValidationErrors)}
        footerText={t('auth.haveAccount')}
        footerLinkText={t('auth.signIn')}
        footerLinkTestID="signup-login-link"
        onFooterLinkPress={() => navigateToLogin()}
        isLoading={isRegistering}
      />
    </AuthWrapper>
  );
};
