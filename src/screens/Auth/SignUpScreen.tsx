// screens/Auth/LoginScreen.tsx
import React from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import {type AuthStackParamList} from '../../navigation/types';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {EmailInput, PasswordInput, BaseInput} from '../../components/atoms';
import {getSignUpValidationSchema} from '../../utils/validation';
import {AuthWrapper} from '../../components/templates/AuthWrapper';

type SignUpValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const SignUpScreen = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
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

  const onSubmit = (data: SignUpValues) => {
    // login…
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<SignUpValues>
        title="Create account"
        subtitle="Join MyApp today"
        onBackPress={() => navigation.goBack()}
        fields={[
          {
            name: 'name',
            label: 'Full Name',
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
