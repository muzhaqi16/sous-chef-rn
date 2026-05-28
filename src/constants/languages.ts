import { SUPPORTED_LANGUAGES } from '#/i18n/config';

// Single source of truth for the language picker. The list is derived from
// `SUPPORTED_LANGUAGES` in `src/i18n/config.ts` so adding a locale there
// automatically surfaces it in the picker — no double-bookkeeping.
export const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES;
