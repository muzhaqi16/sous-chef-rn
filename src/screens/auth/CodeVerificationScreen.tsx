import React, {useEffect} from 'react';
import {useForm} from 'react-hook-form';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {AuthWrapper, AuthFormTemplate, CodeInputAdapter} from '#components';
import {useStore} from '#store';
import {
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
} from '#generated';
import {useAuth, useNavigationFlow} from '#/hooks';

type CodeVerificationValues = {
  code: string;
};

export function CodeVerificationScreen() {
  const {setEmailVerified, setUserNavigationState} = useStore();
  const {user} = useAuth();
  const {navigateToHome, navigateToVerification} = useNavigationFlow();
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
      // Save verification completion for this user
      if (user.id) {
        setUserNavigationState(user.id, {
          lastLoginTimestamp: Date.now(),
        });
      }

      // Use the proper navigation flow system
      navigateToHome();
    }
  }, [user?.emailVerified, user?.id, setUserNavigationState, navigateToHome]);

  const onVerifyCode = async (data: CodeVerificationValues) => {
    const {code} = data;
    try {
      const response = await verifyEmail({
        variables: {code},
      });

      if (response.data?.verifyEmail) {
        setEmailVerified(true);

        // Save verification state for user
        if (user?.id) {
          setUserNavigationState(user.id, {
            lastLoginTimestamp: Date.now(),
          });
        }

        // Navigation will be handled by the useEffect above
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
        // You might want to show a success message to the user here
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

  // Don't render if no user - should be redirected
  if (!user) {
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
