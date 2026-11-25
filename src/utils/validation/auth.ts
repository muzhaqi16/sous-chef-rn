import { object, string, ref } from 'yup';
import {
  emailRule,
  lazyMessage,
  newPasswordRule,
  passwordRule,
} from './common';
import type { KeyUnder } from '#i18n';

const msg = (key: KeyUnder<'auth'>, options?: Record<string, unknown>) =>
  lazyMessage(`auth.${key}`, options);

// yup checks `oneOf` before every other test, so an empty confirmation would
// read as a mismatch; as a test of its own, the match comes after `required`.
const confirmsNewPassword = string()
  .required(msg('newPasswordConfirmRequired'))
  .test(
    'matchesNewPassword',
    msg('passwordsMustMatch'),
    (value, { parent }: { parent: { newPassword?: string } }) =>
      value === parent.newPassword,
  );

// ----------------------------------------------------------------------------

// 1) login (email + password)
export const loginSchema = object({
  email: emailRule,
  password: passwordRule,
});

// ----------------------------------------------------------------------------

// 2) sign-up (name + email + password): the show toggle and a saved
// password replace typing it twice
export const signUpSchema = object({
  name: string().required(msg('fullNameRequired')).min(2, msg('fullNameMin')),
  email: emailRule,
  password: newPasswordRule,
});

// ----------------------------------------------------------------------------

// 3) forgot-password (email only)
export const forgotPasswordSchema = object({
  email: emailRule,
});

// ----------------------------------------------------------------------------

// 4) email-verification (6-digit code)

export const emailVerificationSchema = object({
  code: string()
    .required(msg('codeRequired'))
    .matches(/^\d{6}$/, msg('codeMustBeSixDigits')),
});

// ----------------------------------------------------------------------------

// 5) reset-password (new password + confirm)
export const resetPasswordSchema = object({
  newPassword: newPasswordRule,
  confirmPassword: confirmsNewPassword,
});

// ----------------------------------------------------------------------------

// 6) change-password (current password + new password + confirm)
export const changePasswordSchema = object({
  currentPassword: string().required(msg('currentPasswordRequired')),
  newPassword: newPasswordRule.notOneOf(
    [ref('currentPassword')],
    msg('newPasswordMustDiffer'),
  ),
  confirmPassword: confirmsNewPassword,
});
