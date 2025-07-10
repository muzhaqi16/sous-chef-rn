import React from 'react';
import {useForm} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {AuthFormTemplate} from '../../components/templates/AuthFormTemplate';
import {EmailInput, PasswordInput, BaseInput} from '../../components/atoms';
import {getSignUpValidationSchema} from '../../utils/validation';
import {AuthWrapper} from '../../components/templates/AuthWrapper';
import {SignUpNavProp} from '../../navigation';
import {useSafeNavigation} from '../../hooks';
import {useRegisterMutation} from '../../graphql/generated';
import {useStore} from '../../store';

type SignUpValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const SignUpScreen = () => {
  const {navigation, canGoBack, goBack} = useSafeNavigation<SignUpNavProp>();
  const [register, {loading: isRegistering}] = useRegisterMutation();
  const {setAuth} = useStore();
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
    const {name, email, password} = data;
    try {
      const response = await register({
        variables: {name, email, password},
      });

      if (response.data?.register) {
        console.log('Registration successful:', response.data.register);
        setAuth(
          response.data.register.user,
          response.data.register.accessToken,
          response.data.register.refreshToken,
        );
        navigation.navigate('CodeVerification', {
          email: data.email,
          password: data.password,
        });
      } else {
        console.error('Registration failed:', response.errors);
      }
    } catch (error) {
      console.error('Error during registration:', error);
    }
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
