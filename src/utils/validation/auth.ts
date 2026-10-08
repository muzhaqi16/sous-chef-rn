import { object, string, ref } from 'yup';
import {
  emailRule,
  lazyMessage,
  newPasswordRule,
  passwordRule,
} from './common';
import type { KeyUnder } from '#/i18n';

const msg = (key: KeyUnder<'auth'>, options?: Record<string, unknown>) =>
  lazyMessage(`auth.${key}`, options);

// ----------------------------------------------------------------------------

// 1) login (email + password)
export const loginSchema = object({
  email: emailRule,
  password: passwordRule,
});

export const getLoginValidationSchema = () => loginSchema;

// ----------------------------------------------------------------------------

// 2) sign-up (email + password + confirmPassword)
export const signUpSchema = object({
  name: string().required(msg('fullNameRequired')).min(2, msg('fullNameMin')),
  email: emailRule,
  password: newPasswordRule,
  confirmPassword: string()
    .oneOf([ref('password')], msg('passwordsMustMatch'))
    .required(msg('passwordConfirmRequired')),
});

export const getSignUpValidationSchema = () => signUpSchema;

// ----------------------------------------------------------------------------

// 3) forgot-password (email only)
export const forgotPasswordSchema = object({
  email: emailRule,
});

export const getForgotPasswordValidationSchema = () => forgotPasswordSchema;

// ----------------------------------------------------------------------------

// 4) email-verification (6-digit code)

export const getEmailVerificationValidationSchema = () =>
  object({
    code: string()
      .required(msg('codeRequired'))
      .matches(/^\d{6}$/, msg('codeMustBeSixDigits')),
  });

// ----------------------------------------------------------------------------

// 5) reset-password (new password + confirm)
export const resetPasswordSchema = object({
  newPassword: newPasswordRule,
  confirmPassword: string()
    .oneOf([ref('newPassword')], msg('passwordsMustMatch'))
    .required(msg('newPasswordConfirmRequired')),
});

export const getResetPasswordValidationSchema = () => resetPasswordSchema;

// ----------------------------------------------------------------------------

// 6) change-password (current password + new password + confirm)
export const changePasswordSchema = object({
  currentPassword: string().required(msg('currentPasswordRequired')),
  newPassword: newPasswordRule.notOneOf(
    [ref('currentPassword')],
    msg('newPasswordMustDiffer'),
  ),
  confirmPassword: string()
    .oneOf([ref('newPassword')], msg('passwordsMustMatch'))
    .required(msg('newPasswordConfirmRequired')),
});
