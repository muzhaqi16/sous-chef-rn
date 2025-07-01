import React from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {EmailInput, PasswordInput, BaseInput} from '../../components/atoms';
import {getSignUpValidationSchema} from '../../utils/validation';
import {AuthWrapper} from '../../components/templates/AuthWrapper';
import {signupApi} from '../../api/services/authService';
import {SignUpNavProp} from '../../navigation';
import {useSafeNavigation} from '../../hooks';

type SignUpValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const SignUpScreen = () => {
  const {navigation, canGoBack, goBack} = useSafeNavigation<SignUpNavProp>();
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<SignUpValues>({
    resolver: yupResolver(getSignUpValidationSchema()),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignUpValues) => {
    // Here you would typically call your signup API
    // For example:
    await signupApi(data.name, data.email, data.password)
      .then(response => {
        // Handle successful signup
        console.log('Signup successful:', response);
      })
      .catch(error => {
        // Handle error
        console.error('Signup error:', error);
      });

    console.log('Form submitted with data:', data);
    navigation.navigate('Login'); // Navigate to login after successful signup
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<SignUpValues>
        title="Create account"
        subtitle="Join MyApp today"
        {...(canGoBack ? {onBackPress: goBack} : {})}
        fields={[
          {
            name: 'name',
            label: 'Name',
            placeholder: 'e.g John Doe',
            component: BaseInput,
          },
          {name: 'email', label: 'Email address', component: EmailInput},
          {name: 'password', label: 'Password', component: PasswordInput},
          {
            name: 'confirmPassword',
            label: 'Confirm Password',
            component: PasswordInput,
          },
        ]}
        control={control}
        errors={errors}
        linkText="Forgot password?"
        onLinkPress={() => navigation.navigate('ForgotPassword')}
        submitText="Sign Up"
        onSubmit={handleSubmit(onSubmit)}
        footerText="Already have an account?"
        footerLinkText="Sign In"
        onFooterLinkPress={() => navigation.navigate('Login')}
      />
    </AuthWrapper>
  );
};
