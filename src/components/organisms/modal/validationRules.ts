import type { Translate } from '#/i18n/types';

/**
 * Predefined validation rules for common use cases.
 *
 * A factory rather than a const object: the messages are user-visible, so they
 * must be resolved after i18n is initialised and re-resolved when the language
 * changes — neither of which an import-time object can do.
 */
export const createValidationRules = (t: Translate) => ({
  email: {
    test: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: t('validation.email'),
  },
  minLength: (min: number) => ({
    test: (value: string) => value.trim().length >= min,
    message: t('validation.minLength', { count: min }),
  }),
  maxLength: (max: number) => ({
    test: (value: string) => value.trim().length <= max,
    message: t('validation.maxLength', { count: max }),
  }),
  noSpecialChars: {
    test: (value: string) => /^[a-zA-Z0-9\s]*$/.test(value),
    message: t('validation.noSpecialChars'),
  },
  required: {
    test: (value: string) => value.trim().length > 0,
    message: t('validation.required'),
  },
});
