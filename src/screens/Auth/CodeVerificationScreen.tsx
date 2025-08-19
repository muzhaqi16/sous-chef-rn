import React, {useEffect} from 'react';
import {useForm} from 'react-hook-form';
import {StyleSheet, Text} from 'react-native';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {AuthWrapper, AuthFormTemplate,CodeInputAdapter} from '#components';
import {useStore} from '#store';
import {
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
} from '#generated';

type CodeVerificationValues = {
  code: string;
};

export function CodeVerificationScreen() {
  const {setEmailVerified} = useStore();
  const user = useStore(state => state.user); // More specific selector
  const [verifyEmail] = useVerifyEmailMutation();
  const [resendVerificationEmail] = useResendVerificationEmailMutation();
  const navigation = useNavigation();

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm({
    defaultValues: {code: ''},
  });

  // Handle navigation when email verification status changes
  useEffect(() => {
    if (user?.emailVerified) {
      // Small delay to ensure state has fully updated
      const timeoutId = setTimeout(() => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{name: user.onBoarded ? 'Home' : 'OnBoarding'}],
          }),
        );
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [user?.emailVerified, user?.onBoarded, navigation]);

  const onVerifyCode = async (data: CodeVerificationValues) => {
    const {code} = data;
    try {
      const response = await verifyEmail({
        variables: {code},
      });
      if (response.data?.verifyEmail) {
        setEmailVerified(true);
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{name: user?.onBoarded ? 'Home' : 'OnBoarding'}],
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

  // Don't render the screen if already verified
  if (user?.emailVerified) {
    return null;
  }

  return (
    <AuthWrapper>
      <AuthFormTemplate
        title="Enter Code"
        subtitle={
          <>
            We emailed a code to{' '}
            <Text style={{fontWeight: 'bold'}}>
              {user?.email || 'your email'}
            </Text>
            . Please enter the code to continue.
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