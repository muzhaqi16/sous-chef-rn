// screens/Auth/LoginScreen.tsx
import React from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import {type AuthStackParamList} from '../../navigation/types';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {EmailInput, PasswordInput} from '../../components/atoms';
import {getLoginValidationSchema} from '../../utils/validation';
import {AuthWrapper} from '../../components/templates/AuthWrapper';

type LoginValues = {email: string; password: string};

export function LoginScreen() {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<LoginValues>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: {email: '', password: ''},
  });

  const onSubmit = (data: LoginValues) => {
    // login…
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<LoginValues>
        title="Sign in to MyApp"
        subtitle="Access your portfolio and more"
        fields={[
          {name: 'email', label: 'Email address', component: EmailInput},
          {name: 'password', label: 'Password', component: PasswordInput},
        ]}
        control={control}
        errors={errors}
        linkText="Forgot password?"
        onLinkPress={() => navigation.navigate('ForgotPassword')}
        submitText="Login"
        onSubmit={handleSubmit(onSubmit)}
        footerText="Don't have an account?"
        footerLinkText="Sign Up"
        onFooterLinkPress={() => navigation.navigate('SignUp')}
      />
    </AuthWrapper>
  );
}
