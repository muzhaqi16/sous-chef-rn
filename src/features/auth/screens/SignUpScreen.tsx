import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import { useTranslation } from '#/i18n';

import { AuthFormTemplate } from '#features/auth/components/AuthFormTemplate';
import { AuthWrapper } from '#features/auth/components/AuthWrapper';
import { CodeVerificationScreen } from '#features/auth/screens/CodeVerificationScreen';
import { EmailInput } from '#components/molecules/EmailInput';
import { PasswordInput } from '#components/molecules/PasswordInput';
import { NameInput } from '#components/molecules/NameInput';
import { getSignUpValidationSchema } from '#/utils/validation/auth';
import { logValidationErrors } from '#/utils/validation/common';
import type { RegisterInput } from '#/graphql/generated/schemaTypes';
import { authService } from '#/services/authService';
import { useAppStore } from '#store/useAppStore';
import { useAuthNavigation } from '#features/auth/hooks/useAuthNavigation';
import { authTestIDs } from '#features/auth/testIDs';

type SignUpValues = RegisterInput & { confirmPassword: string; name: string };

export const SignUpScreen = (): React.JSX.Element => {
  const { t } = useTranslation();
  const isRegistering = useAppStore(state => state.authIsLoading);
  const { navigateToLogin } = useAuthNavigation();

  // A successful `register` mails a code and signs in, which hands over to the
  // root navigator's verification gate. An address that refuses the password
  // (taken, or a deleted account) swaps the form for code entry instead.
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
    let outcome;
    try {
      outcome = await authService.register(input);
    } catch (err) {
      authService.handleAuthError(err, 'Registration');
    }

    if (outcome === 'verificationSent') {
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
    <AuthWrapper testID={authTestIDs.signUpScreen}>
      <AuthFormTemplate<SignUpValues>
        title={t('auth.signupTitle')}
        subtitle={t('auth.signupSubtitle')}
        fields={[
          {
            name: 'name',
            label: t('auth.name'),
            placeholder: t('auth.namePlaceholder'),
            component: NameInput,
            props: { testID: authTestIDs.signUpNameInput },
          },
          {
            name: 'email',
            label: t('auth.emailAddress'),
            component: EmailInput,
            props: { testID: authTestIDs.signUpEmailInput },
          },
          {
            name: 'password',
            label: t('auth.password'),
            component: PasswordInput,
            props: { testID: authTestIDs.signUpPasswordInput },
            // The match rule reports on `confirmPassword` while reading this
            // field, so editing this one has to re-run that one.
            deps: ['confirmPassword'],
          },
          {
            name: 'confirmPassword',
            label: t('auth.confirmPassword'),
            component: PasswordInput,
            props: { testID: authTestIDs.signUpConfirmPasswordInput },
          },
        ]}
        control={form.control}
        errors={form.formState.errors}
        focusChaining
        submitText={
          isRegistering ? t('auth.creatingAccount') : t('auth.signUp')
        }
        submitButtonTestID={authTestIDs.signUpSubmitButton}
        onSubmit={form.handleSubmit(onSubmit, logValidationErrors)}
        footerText={t('auth.haveAccount')}
        footerLinkText={t('auth.signIn')}
        footerLinkTestID={authTestIDs.signUpLoginLink}
        onFooterLinkPress={() => navigateToLogin()}
        isLoading={isRegistering}
      />
    </AuthWrapper>
  );
};
