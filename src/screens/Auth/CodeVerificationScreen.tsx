import React, {useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {useForm} from 'react-hook-form';
import {AuthWrapper} from '../../components/templates/AuthWrapper';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {CodeInputAdapter} from '../../components/molecules/CodeInputAdapter';
import {useStore} from '../../store';
import {
  verifyEmailApi,
  resendVerificationEmailApi,
} from '../../api/services/authService';

type CodeVerificationValues = {
  code: string;
};

export function CodeVerificationScreen() {
  const {setEmailVerified, user} = useStore();

  const email = user?.email ?? '';

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<CodeVerificationValues>({
    defaultValues: {code: ''},
  });

  const onVerifyCode = async (data: CodeVerificationValues) => {
    const {code} = data;
    const status = await verifyEmailApi(code);
    if (status) {
      setEmailVerified(true);
      console.log('Code verified successfully:', code);
    }
  };

  const onResend = async () => {
    await resendVerificationEmailApi(email)
      .then(() => {
        console.log('Verification email resent successfully');
      })
      .catch(error => {
        console.error('Error resending verification email:', error);
      });
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<CodeVerificationValues>
        title="Enter Code"
        subtitle={
          <>
            We emailed a code to <Text style={{color: '#222'}}>{email}</Text>.
            Please enter the code to continue.
          </>
        }
        fields={[{name: 'code', label: '', component: CodeInputAdapter}]}
        control={control}
        errors={errors}
        submitText="Submit"
        onSubmit={handleSubmit(onVerifyCode)}
        footerText="Didn't get the email?"
        footerLinkText="Resend code"
        onFooterLinkPress={onResend}
      />
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffdada',
    marginBottom: 16,
  },
});
