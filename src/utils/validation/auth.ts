import * as yup from 'yup';
import {emailRule, passwordRule} from './common';

// ----------------------------------------------------------------------------

// 1) login (email + password)
export const loginSchema = yup.object({
  email: emailRule,
  password: passwordRule,
});

// usage in your LoginForm:
// const { control, handleSubmit, formState } = useForm<FormValues>({
//   resolver: yupResolver(loginSchema),
//   defaultValues: { email: '', password: '' },
// })

export const getLoginValidationSchema = () => loginSchema;

// ----------------------------------------------------------------------------

// 2) sign-up (email + password + confirmPassword)
export const signUpSchema = yup.object({
  name: yup
    .string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: emailRule,
  password: passwordRule,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

// usage in SignUpForm:
// const { control, handleSubmit, formState } = useForm<FormValues>({
//   resolver: yupResolver(signUpSchema),
//   defaultValues: { email: '', password: '', confirmPassword: '' },
// })

export const getSignUpValidationSchema = () => signUpSchema;

// ----------------------------------------------------------------------------

// 3) forgot-password (email only)
export const forgotPasswordSchema = yup.object({
  email: emailRule,
});

// usage in ForgotPasswordScreen:
// const { control, handleSubmit, formState } = useForm<{email:string}>({
//   resolver: yupResolver(forgotPasswordSchema),
//   defaultValues: { email: '' },
// })

export const getForgotPasswordValidationSchema = () => forgotPasswordSchema;

// ----------------------------------------------------------------------------

// 4) email-verification (6-digit code)
export const emailVerificationSchema = yup.object({
  code: yup
    .string()
    .required('Verification code is required')
    .matches(/^\d{6}$/, 'Code must be 6 digits'),
});

// usage in EmailVerificationScreen:
// const { control, handleSubmit, formState } = useForm<{code:string}>({
//   resolver: yupResolver(emailVerificationSchema),
//   defaultValues: { code: '' },
// })

export const getEmailVerificationValidationSchema = () =>
  emailVerificationSchema;

// ----------------------------------------------------------------------------

// 5) reset-password (new password + confirm)
export const resetPasswordSchema = yup.object({
  password: passwordRule,
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your new password'),
});

// usage in ResetPasswordScreen:
// const { control, handleSubmit, formState } = useForm<{password:string;confirmPassword:string}>({
//   resolver: yupResolver(resetPasswordSchema),
//   defaultValues: { password: '', confirmPassword: '' },
// })

export const getResetPasswordValidationSchema = () => resetPasswordSchema;
