import { string, ValidationError, type Schema } from 'yup';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import { logger } from '#/utils/environment';
import { t, type TranslationKey } from '#/i18n';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

/**
 * A rule's message. Schemas are built once at module scope, so a message
 * resolved eagerly would freeze whichever language was active at import time;
 * yup calls this when the rule fails, after any language change.
 */
export const lazyMessage =
  (key: TranslationKey, options?: Record<string, unknown>) => (): string =>
    t(key, options);

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

/**
 * A typed name, cleaned rather than refused, as the API stores an item's: a
 * control character dropped (a space if it was whitespace), ends trimmed, each
 * run of whitespace one space. Smart punctuation is mapped too, since the API's
 * matching tells ’ from '.
 */
export function cleanName(value: string | undefined): string | undefined {
  const mapped = normalizeSmartPunctuation(value);
  if (!mapped) return mapped;
  return mapped
    .replace(/\p{Cc}/gu, char => (/\s/u.test(char) ? ' ' : ''))
    .trim()
    .replace(/\s+/g, ' ');
}

/** The API's caps on a name once cleaned, as each input's description states. */
export const MAX_ITEM_NAME_LENGTH = 128;
export const MAX_PERSON_NAME_LENGTH = 255;
const MAX_HOME_NAME_LENGTH = 100;

/**
 * An item name as the API takes it: any text, cleaned, then required and at
 * most `MAX_ITEM_NAME_LENGTH`. `required` is the caller's own message.
 */
export const itemNameText = (required: () => string) =>
  string()
    .transform(cleanName)
    .required(required)
    .max(
      MAX_ITEM_NAME_LENGTH,
      lazyMessage('errors.nameTooLong', { max: MAX_ITEM_NAME_LENGTH }),
    );

/**
 * A home name as the API takes it (CreateHomeInput, UpdateHomeInput): any
 * text, cleaned, then required and at most `MAX_HOME_NAME_LENGTH`.
 */
export const homeNameRule = string()
  .transform(cleanName)
  .required(lazyMessage('errors.homeNameRequired'))
  .max(
    MAX_HOME_NAME_LENGTH,
    lazyMessage('errors.nameTooLong', { max: MAX_HOME_NAME_LENGTH }),
  );

/** The message `rule` gives `value`, or null when it passes: a field checked on its own. */
export function fieldError(rule: Schema, value: unknown): string | null {
  try {
    rule.validateSync(value);
    return null;
  } catch (error) {
    if (error instanceof ValidationError) return error.message;
    throw error;
  }
}

export function logValidationErrors(errors: FieldErrors<FieldValues>) {
  const fields = Object.entries(errors)
    .map(([key, err]) => {
      const message = err?.message;
      return `${key}: ${typeof message === 'string' ? message : 'undefined'}`;
    })
    .join(', ');
  logger.warn('Form validation failed:', fields);
}

// --- shared rules ------------------------------------------------------------

// The API's EmailAddress scalar (zod's format, at most 254 characters) refuses
// before any resolver, with no field for the message, so every email field
// holds this line; yup's `.email()` passes `a@b` and `a..b@c.com`.
const EMAIL_ADDRESS =
  /^(?!\.)(?!.*\.\.)[\w'+.-]*[\w+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export const isEmailAddress = (value: string | undefined): boolean =>
  !value || (value.length <= 254 && EMAIL_ADDRESS.test(value));

export const emailRule = string()
  .test('email', lazyMessage('commonValidation.emailInvalid'), isEmailAddress)
  .required(lazyMessage('commonValidation.emailRequired'));

// Sign-in reads back a password the user ALREADY has, so no policy rule: like
// the server's login schema, only non-empty plus bcrypt's 72 cap, which no
// stored password can exceed.
export const passwordRule = string()
  .required(lazyMessage('commonValidation.passwordRequired'))
  .max(72, lazyMessage('commonValidation.passwordMax'));

// The server's policy for a password being SET, checked here so the user is
// told which rule they missed instead of a generic refusal.
export const newPasswordRule = string()
  .required(lazyMessage('commonValidation.passwordRequired'))
  .min(8, lazyMessage('commonValidation.passwordMin'))
  .max(72, lazyMessage('commonValidation.passwordMax'))
  .matches(/[a-z]/, lazyMessage('commonValidation.passwordLowercase'))
  .matches(/[A-Z]/, lazyMessage('commonValidation.passwordUppercase'))
  .matches(/[0-9]/, lazyMessage('commonValidation.passwordNumber'));

// A first or last name in any script ("José", "李"), cleaned rather than refused.
export const nameRule = string()
  .transform(cleanName)
  .max(
    MAX_PERSON_NAME_LENGTH,
    lazyMessage('errors.nameTooLong', { max: MAX_PERSON_NAME_LENGTH }),
  );

// A quantity takes a fraction ("1 1/4") as readily as a decimal, so the rule
// runs on what `parseFractionalInput` reads — a regex restating its grammar
// drifts from it (one took only `.`, and `2,5` became unreachable).
export const quantityRule = (
  key: TranslationKey,
  { allowZero = false }: { allowZero?: boolean } = {},
) =>
  string()
    .defined()
    .test('quantity', lazyMessage(key), value => {
      const parsed = parseFractionalInput(value);
      if (parsed === null || Number.isNaN(parsed)) return false;
      return allowZero ? parsed >= 0 : parsed > 0;
    });

// An amount paid: null when blank (unstated), undefined when unusable. Only
// digits and separators pass: `parseFloat` reads `4,99x` as 4.99, and a sign
// makes it no price.
export const parseMoneyInput = (value: string): number | null | undefined => {
  if (!value.trim()) return null;
  if (!/^[\d.,\s]+$/.test(value)) return undefined;
  const parsed = parseDecimalInput(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const optionalMoneyRule = (key: TranslationKey) =>
  string()
    .defined()
    .test(
      'money',
      lazyMessage(key),
      value => parseMoneyInput(value) !== undefined,
    );

// A measure such as a package size: a decimal above zero, never a fraction.
export const positiveDecimalRule = (
  key: TranslationKey,
  { optional = false }: { optional?: boolean } = {},
) =>
  string()
    .defined()
    .test('positive-decimal', lazyMessage(key), value => {
      if (optional && !value.trim()) return true;
      const parsed = parseDecimalInput(value);
      return !Number.isNaN(parsed) && parsed > 0;
    });
