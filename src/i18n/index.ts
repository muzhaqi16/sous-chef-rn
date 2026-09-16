/**
 * The single entry point for translation: `useTranslation()` inside a component
 * or hook, the module-scope `t` everywhere else. Everything is DEFINED here
 * rather than re-exported — `no-barrel-files` bans the re-export form.
 */
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import type { UseTranslationOptions } from 'react-i18next';
import type { ParseKeys, TOptions } from 'i18next';
import { getI18n } from './config';

// ---------------------------------------------------------------------------
// Translating
// ---------------------------------------------------------------------------

/** A key the English copy declares; a plural key is named without its suffix. */
export type TranslationKey = ParseKeys;

/** The keys under `prefix.`, relative to it: `KeyUnder<'itemValidation'>`. */
export type KeyUnder<Prefix extends string> = TranslationKey extends infer Key
  ? Key extends `${Prefix}.${infer Rest}`
    ? Rest
    : never
  : never;

/**
 * A key composed at runtime from data the types cannot see (a server `field`,
 * a refusal code), checked against the loaded copy before it is translated.
 */
export function isTranslationKey(key: string): key is TranslationKey {
  const i18n = getI18n();
  // A plural key is declared only with its suffixes, so it exists for a count.
  return i18n.exists(key) || i18n.exists(key, { count: 2 });
}

/**
 * A translate function. It takes no fallback copy: a fallback renders English
 * in every locale and hides the missing key (`sous-chef/no-t-default-value`).
 */
export interface TranslateFn {
  (key: TranslationKey, options?: TOptions): string;
}

/**
 * Module-scope translation, for code that cannot run a hook. Does NOT subscribe
 * to language changes — in a component or hook use `useTranslation()`, which
 * `sous-chef/no-module-level-t` enforces for `.tsx`. Delegates straight to
 * i18next, so key echo and interpolation are native.
 */
export function t(key: TranslationKey, options?: TOptions): string {
  return getI18n().t(key, options);
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
  // `init` runs synchronously with inline resources, so `language` is set by
  // the time `getI18n()` is reachable.
  return (i18n.resolvedLanguage ?? i18n.language).split('-')[0] ?? 'en';
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
