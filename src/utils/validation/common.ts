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

// "strong-ish" password rule: 8+ chars, at least one letter and one number
export const passwordRule = string()
  .required(msg('passwordRequired'))
  .min(8, msg('passwordMin'))
  .matches(/[A-Za-z]/, msg('passwordLetter'))
  .matches(/[0-9]/, msg('passwordNumber'));

// name rules (for firstName, lastName)
export const nameRule = string()
  .transform(normalizeSmartPunctuation)
  .min(2, msg('nameMin'))
  .max(50, msg('nameMax'))
  .matches(/^[a-zA-Z\s'-]+$/, msg('nameChars'));
