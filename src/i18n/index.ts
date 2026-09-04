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

// ---------------------------------------------------------------------------
// The current language
// ---------------------------------------------------------------------------

/**
 * The language i18next actually resolved, stripped of any region suffix, with
 * `en` as the floor. Defined here so nothing outside `src/i18n` reaches the
 * instance for it — the tag drives date-fns locales and Android channel copy,
 * and both want the same normalization.
 */
export function getResolvedLanguage(): string {
  const i18n = getI18n();
  return (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
}

/**
 * Switch languages. The store owns WHEN this happens; the instance stays behind
 * this entry point so the switch cannot drift from how the language is read.
 */
export async function changeLanguage(language: string): Promise<void> {
  await getI18n().changeLanguage(language);
}

/**
 * Run `listener` after every language change; returns the unsubscribe. Anything
 * cached per language — an Android channel name, a memoized formatter — renews
 * itself here rather than waiting to be rebuilt by chance.
 */
export function onLanguageChanged(listener: () => void): () => void {
  const i18n = getI18n();
  i18n.on('languageChanged', listener);
  return () => i18n.off('languageChanged', listener);
}
