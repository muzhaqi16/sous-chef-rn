import { string } from 'yup';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import { logger } from '#/utils/environment';
import { getI18n } from '#/i18n/config';

/**
 * These rules are built once at module scope, so a message resolved eagerly
 * would freeze whichever language was active at import time. Yup calls the
 * function when the rule fails, so the lookup lands after any language change.
 */
const msg = (key: string, options?: Record<string, unknown>) => (): string =>
  getI18n().t(`commonValidation.${key}`, options);

// --- shared helpers ----------------------------------------------------------

export function normalizeSmartPunctuation(
  value: string | undefined,
): string | undefined {
  if (!value) return value;
  return value
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-');
}

export function logValidationErrors(errors: FieldErrors<FieldValues>) {
  const fields = Object.entries(errors)
    .map(([key, err]) => `${key}: ${err?.message}`)
    .join(', ');
  logger.warn('Form validation failed:', fields);
}

// --- shared rules ------------------------------------------------------------

// "standard" email rule
export const emailRule = string()
  .email(msg('emailInvalid'))
  .required(msg('emailRequired'));

// Sign-in reads back a password the user ALREADY has, so a policy rule here
// refuses a password the account really has, with no way in — the reset flow
// needs the account it cannot reach. The server agrees: its login schema is
// non-empty plus the 72 cap, and nothing else. The cap is bcrypt's limit rather
// than a policy, so it holds on every path and no stored password can exceed it.
export const passwordRule = string()
  .required(msg('passwordRequired'))
  .max(72, msg('passwordMax'));

// The server's own policy, for a password being SET: 8-72 characters with a
// lowercase letter, an uppercase letter and a digit. Checked here so a password
// that cannot succeed never costs a round trip — and so the user is told which
// rule they missed instead of reading a generic refusal.
export const newPasswordRule = string()
  .required(msg('passwordRequired'))
  .min(8, msg('passwordMin'))
  .max(72, msg('passwordMax'))
  .matches(/[a-z]/, msg('passwordLowercase'))
  .matches(/[A-Z]/, msg('passwordUppercase'))
  .matches(/[0-9]/, msg('passwordNumber'));

// name rules (for firstName, lastName)
export const nameRule = string()
  .transform(normalizeSmartPunctuation)
  .min(2, msg('nameMin'))
  .max(50, msg('nameMax'))
  .matches(/^[a-zA-Z\s'-]+$/, msg('nameChars'));
