import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {useForm} from 'react-hook-form';
import {AuthWrapper} from '../../components/templates/AuthWrapper';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {CodeInputAdapter} from '../../components/molecules/CodeInputAdapter';
import {useStore} from '../../store';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
} from '../../graphql/generated';

type CodeVerificationValues = {
  code: string;
};

export function CodeVerificationScreen() {
  const {setEmailVerified, user} = useStore();
  const [verifyEmail] = useVerifyEmailMutation();
  const [resendVerificationEmail] = useResendVerificationEmailMutation();
  const navigation = useNavigation();
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<CodeVerificationValues>({
    defaultValues: {code: ''},
  });

  const onVerifyCode = async (data: CodeVerificationValues) => {
    const {code} = data;

    try {
      const response = await verifyEmail({
        variables: {code},
      });

      if (response.data?.verifyEmail) {
        setEmailVerified(true);
        // 3. Reset the root nav state in one go
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                // if they still need onboarding, send them there,
                // otherwise straight to HomeTab
                name: user?.onBoarded ? 'Home' : 'OnBoarding',
              },
            ],
          }),
        );
      } else {
        console.error('Email verification failed');
      }
    } catch (error) {
      console.error('Error verifying email:', error);
    }
  };

  const onResend = async () => {
    try {
      if (!user?.email) {
        console.error('No email available to resend verification');
        return;
      }
      const response = await resendVerificationEmail({
        variables: {email: user.email},
      });

      if (response.data?.resendVerificationEmail) {
        console.log('Verification email resent successfully');
      } else {
        console.error('Failed to resend verification email');
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
    }
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<CodeVerificationValues>
        title="Enter Code"
        subtitle={
          <>
            We emailed a code to{' '}
            <Text style={{color: '#222'}}>{user?.email || 'your email'}</Text>.
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
