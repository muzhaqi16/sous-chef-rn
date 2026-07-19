import { object, string, ref } from 'yup';
import { emailRule, passwordRule } from './common';
import { getI18n } from '#/i18n/config';

/**
 * These schemas are built once at module scope, so a message resolved eagerly
 * would freeze whichever language was active at import time. Yup calls the
 * function when the rule fails, so the lookup lands after any language change.
 */
const msg = (key: string, options?: Record<string, unknown>) => (): string =>
  getI18n().t(`auth.${key}`, options);

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
  name: string().required(msg('fullNameRequired')).min(2, msg('fullNameMin')),
  email: emailRule,
  password: passwordRule,
  confirmPassword: string()
    .oneOf([ref('password')], msg('passwordsMustMatch'))
    .required(msg('passwordConfirmRequired')),
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
// usage in CodeVerificationScreen:
// const { control, handleSubmit, formState } = useForm({
//   resolver: yupResolver(getEmailVerificationValidationSchema()),
//   defaultValues: { code: '' },
// })

export const getEmailVerificationValidationSchema = () =>
  object({
    code: string()
      .required(msg('codeRequired'))
      .matches(/^\d{6}$/, msg('codeMustBeSixDigits')),
  });

// ----------------------------------------------------------------------------

// 5) reset-password (new password + confirm)
export const resetPasswordSchema = object({
  password: passwordRule,
  confirmPassword: string()
    .oneOf([ref('password')], msg('passwordsMustMatch'))
    .required(msg('newPasswordConfirmRequired')),
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
  currentPassword: string().required(msg('currentPasswordRequired')),
  newPassword: passwordRule.notOneOf(
    [ref('currentPassword')],
    msg('newPasswordMustDiffer'),
  ),
  confirmPassword: string()
    .oneOf([ref('newPassword')], msg('passwordsMustMatch'))
    .required(msg('newPasswordConfirmRequired')),
});

// usage in ChangePasswordScreen:
// const { control, handleSubmit, formState } = useForm<ChangePasswordForm>({
//   resolver: yupResolver(changePasswordSchema),
//   defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
// })

export const getChangePasswordValidationSchema = () => changePasswordSchema;
