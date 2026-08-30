/**
 * The single entry point for translation: `useTranslation()` inside a component
 * or hook, the module-scope `t` everywhere else. Everything is DEFINED here
 * rather than re-exported — `no-barrel-files` bans the re-export form.
 */
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { UseTranslationOptions } from 'react-i18next';
import type { TOptions } from 'i18next';
import { getI18n } from './config';

// ---------------------------------------------------------------------------
// Translating
// ---------------------------------------------------------------------------

/** A translate function, in either of its two calling forms. */
export interface TranslateFn {
  (key: string, options?: TOptions): string;
  (key: string, fallback: string | undefined, options?: TOptions): string;
}

/**
 * Module-scope translation, for code that cannot run a hook. Does NOT subscribe
 * to language changes — in a component or hook use `useTranslation()`, which a
 * `no-restricted-syntax` rule enforces for `.tsx`. Delegates straight to
 * i18next, so key echo, string fallback and interpolation are native.
 */
export function t(key: string, options?: TOptions): string;
export function t(
  key: string,
  fallback: string | undefined,
  options?: TOptions,
): string;
export function t(
  key: string,
  fallbackOrOptions?: string | TOptions,
  options?: TOptions,
): string {
  return typeof fallbackOrOptions === 'string'
    ? getI18n().t(key, fallbackOrOptions, options)
    : getI18n().t(key, fallbackOrOptions);
}

/**
 * Translation for components and hooks; subscribes to language changes, which
 * the module-scope `t` does not. A thin pass-through to react-i18next that
 * exists only to give translation one import path — the returned `t` keeps
 * react-i18next's identity across renders. The one namespace is pinned here.
 */
export function useTranslation(options?: UseTranslationOptions<undefined>) {
  return useI18nextTranslation(undefined, options);
}
