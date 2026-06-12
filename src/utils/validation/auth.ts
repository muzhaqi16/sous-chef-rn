import { object, string, ref } from 'yup';
import { emailRule, passwordRule } from './common';

// ----------------------------------------------------------------------------

// 1) login (email + password)
export const loginSchema = object({
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
export const signUpSchema = object({
  name: string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters'),
  email: emailRule,
  password: passwordRule,
  confirmPassword: string()
    .oneOf([ref('password')], 'Passwords must match')
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
export const forgotPasswordSchema = object({
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
type TranslateFn = (key: string) => string;

// usage in CodeVerificationScreen:
// const { control, handleSubmit, formState } = useForm({
//   resolver: yupResolver(getEmailVerificationValidationSchema(t)),
//   defaultValues: { code: '' },
// })

export const getEmailVerificationValidationSchema = (t: TranslateFn) =>
  object({
    code: string()
      .required(t('auth.codeRequired'))
      .matches(/^\d{6}$/, t('auth.codeMustBeSixDigits')),
  });

// ----------------------------------------------------------------------------

// 5) reset-password (new password + confirm)
export const resetPasswordSchema = object({
  password: passwordRule,
  confirmPassword: string()
    .oneOf([ref('password')], 'Passwords must match')
    .required('Please confirm your new password'),
});

// usage in ResetPasswordScreen:
// const { control, handleSubmit, formState } = useForm<{password:string;confirmPassword:string}>({
//   resolver: yupResolver(resetPasswordSchema),
//   defaultValues: { password: '', confirmPassword: '' },
// })

export const getResetPasswordValidationSchema = () => resetPasswordSchema;

// ----------------------------------------------------------------------------

// 6) change-password (current password + new password + confirm)
export const changePasswordSchema = object({
  currentPassword: string().required('Current password is required'),
  newPassword: passwordRule.notOneOf(
    [ref('currentPassword')],
    'New password must be different from current password',
  ),
  confirmPassword: string()
    .oneOf([ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password'),
});

// usage in ChangePasswordScreen:
// const { control, handleSubmit, formState } = useForm<ChangePasswordForm>({
//   resolver: yupResolver(changePasswordSchema),
//   defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
// })

export const getChangePasswordValidationSchema = () => changePasswordSchema;
