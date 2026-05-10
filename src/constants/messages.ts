/**
 * Centralized message constants for the application.
 *
 * @deprecated Prefer `t()` from `'#/i18n/t'` (module/scope code) or
 *   `useTranslation()` from `'react-i18next'` (React components). This re-export
 *   keeps existing `MESSAGES.x.y` call sites compiling against the same English
 *   strings now sourced from `src/i18n/locales/en.json`.
 */
import en from '#/i18n/locales/en.json';

/** @deprecated Use `t()` from '#/i18n/t' or `useTranslation()` from 'react-i18next'. */
export const MESSAGES = en;
