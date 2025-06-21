// screens/Auth/LoginScreen.tsx
import React from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {useNavigation} from '@react-navigation/native';
import {LoginNavProp} from '../../navigation/types';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {EmailInput, PasswordInput} from '../../components/atoms';
import {getLoginValidationSchema} from '../../utils/validation';
import {AuthWrapper} from '../../components/templates/AuthWrapper';
import {useStore} from '../../store/useStore';

type LoginValues = {email: string; password: string};

export function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<LoginValues>({
    resolver: yupResolver(getLoginValidationSchema()),
    defaultValues: {email: 'artan@muzhaqi.com', password: 'Test123!'},
  });
  const {login} = useStore();
  const onSubmit = async (data: LoginValues) => {
    const {email, password} = data;
    const error = await login(email, password);
    if (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<LoginValues>
        title="Sign in to MyApp"
        subtitle="Access your portfolio and more"
        onBackPress={() => navigation.goBack()}
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
