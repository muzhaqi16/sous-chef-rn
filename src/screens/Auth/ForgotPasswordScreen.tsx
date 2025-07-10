import React from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import {type AuthStackParamList} from '../../navigation/types';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {EmailInput} from '../../components/atoms';
import {getForgotPasswordValidationSchema} from '../../utils/validation';
import {AuthWrapper} from '../../components/templates/AuthWrapper';
import {useForgotPasswordMutation} from '../../graphql/generated';

type ForgotPasswordValues = {
  email: string;
};

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();

  const [forgotPasswordApi] = useForgotPasswordMutation();

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<ForgotPasswordValues>({
    resolver: yupResolver(getForgotPasswordValidationSchema()),
    defaultValues: {email: ''},
  });

  const sendResetEmail = async (data: ForgotPasswordValues) => {
    const {email} = data;
    // Simulate sending reset email
    console.log(`Sending reset email to: ${email}`);
    try {
      await forgotPasswordApi({
        variables: {email},
      });
      console.log('Reset email sent successfully');
      navigation.navigate('Login'); // Navigate back to login after sending
    } catch (error) {
      console.error('Error sending reset email:', error);
      // Handle error, e.g., show a toast or alert
    }
    // Here you would typically call your API to send the reset email
    // For example: await api.sendResetEmail(email);
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<ForgotPasswordValues>
        title="Forgot password"
        subtitle="Enter your email to reset"
        fields={[
          {name: 'email', label: 'Email address', component: EmailInput},
        ]}
        control={control}
        errors={errors}
        submitText="Send Reset Link"
        onSubmit={handleSubmit(sendResetEmail)}
        footerText="Remembered it?"
        footerLinkText="Sign In"
        onFooterLinkPress={() => navigation.navigate('Login')}
      />
    </AuthWrapper>
  );
}
