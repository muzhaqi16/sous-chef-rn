/**
 * The single entry point for translation.
 *
 * Before this there were four idioms, and nine files used two of them at once
 * depending on whether the string had a variable in it:
 *
 *     const { t } = useTranslation()        // react-i18next, in components
 *     t('key')            from '#/i18n/t'   // module scope, no options (module since deleted)
 *     getI18n().t('key', { count })         // module scope, when options needed
 *     import { t as tGlobal }               // components needing module scope
 *
 * Now there are two, and they differ only by whether you are in a component:
 *
 *     const { t } = useTranslation()  from '#/i18n'   // components and hooks
 *     import { t } from '#/i18n'                      // module scope
 *
 * Everything is DEFINED here rather than re-exported from sibling modules —
 * `no-barrel-files` bans the re-export form, and a single entry point that is
 * also a single module is what that rule is asking for anyway.
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
 * Module-scope translation, for code that cannot run a hook — services,
 * utilities, mutation `onError` handlers.
 *
 * Inside a component or hook use `useTranslation()` below, which subscribes to
 * language changes. A `no-restricted-syntax` rule in `.eslintrc.js` enforces
 * that for `src/**\/*.tsx`; a file that genuinely needs this one (a class
 * component, module scope) imports it as `tGlobal`.
 *
 * This delegates straight to i18next. It used to reimplement three things
 * i18next already does, which is why call sites needing interpolation bypassed
 * it and called `getI18n().t(...)` directly — 25 of them across 15 files.
 *
 * Verified 2026-08-17 against the installed `i18next@26` by initialising a real
 * instance (`lng: 'es'`, `fallbackLng: 'en'`, `returnObjects: false`):
 *
 *   t('missing.key')                 -> "missing.key"      // key echo is native
 *   t('missing', 'String fallback')  -> "String fallback"  // string fallback is native
 *   t('only.en')                     -> "English only"     // fallbackLng is native
 *   t('greet', { name: 'Ada' })      -> "Hola Ada"         // interpolation
 *
 * The one behaviour the old implementation had that this does not: for a key
 * naming an object node (`t('errors')`), i18next returns
 * `"key 'errors (en)' returned an object instead of string."` and `defaultValue`
 * does NOT override it, where the old helper returned the key. Both render
 * visibly-wrong text for what is a bug at the call site, and i18next's version
 * names the problem — not worth a hand-rolled resolver plus a hand-rolled
 * `fallbackLng` chain to avoid.
 *
 * @param key Dot-path key matching the JSON locale structure.
 * @param fallback Returned if the key doesn't resolve. Omit it and a missing
 *   key renders as its own dot-path, which stays traceable rather than
 *   silently emitting `""`.
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
 * Translation for components and hooks. Subscribes to language changes, which
 * the module-scope `t` deliberately does not.
 *
 * This is a thin pass-through to react-i18next, and deliberately stays thin —
 * the helper it replaced earned its keep by reimplementing library behaviour,
 * and that is exactly what made it a problem. It exists for one reason: so
 * there is a single import path for translation. Everything else about it is
 * react-i18next's, including the returned `t`'s identity across renders, so
 * using `t` in a dependency array behaves exactly as before.
 *
 * The app has one namespace, so the namespace argument is pinned to the
 * default rather than left to each call site.
 */
export function useTranslation(options?: UseTranslationOptions<undefined>) {
  return useI18nextTranslation(undefined, options);
}
