import { getI18n } from './config';

/**
 * Lightweight translation helper — delegates to the configured i18next instance.
 *
 * Usage: `t('errors.addItemFailed')` instead of `MESSAGES.errors.addItemFailed`.
 *
 * Inside React components prefer `useTranslation()` from `react-i18next`, which
 * subscribes the component to language changes. `t()` is for module/scope code
 * (mutation `onError` handlers, services, utilities) where a hook can't be used.
 *
 * @param key Dot-path key matching the JSON locale structure (e.g. `errors.addItemFailed`).
 * @param fallback Returned if the key doesn't resolve. Defaults to the key itself
 *   so missing translations stay traceable in the UI rather than silently emitting `""`.
 */
export function t(key: string, fallback?: string): string {
  const i18n = getI18n();
  // Peek at the resource directly so we can preserve the legacy contract:
  // any non-string resolution (missing key OR object node like `errors`)
  // returns the fallback. With `returnObjects: false`, `i18n.t()` emits a
  // warning string for object nodes rather than honoring `defaultValue`.
  //
  // The peek walks the same chain `i18n.t` would — resolved language first,
  // then `fallbackLng`. Peeking only at the resolved language made this helper
  // the single place where `fallbackLng` did NOT apply, so a key present only
  // in en rendered as its raw dot-path ('errors.notFoundTitle') under es/it/sq.
  const lng = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  let raw = i18n.getResource(lng, 'translation', key);
  if (raw === undefined) {
    for (const next of fallbackLanguages(i18n.options.fallbackLng)) {
      raw = i18n.getResource(next, 'translation', key);
      if (raw !== undefined) break;
    }
  }
  if (typeof raw !== 'string') {
    return fallback ?? key;
  }
  return i18n.t(key, { defaultValue: fallback ?? key });
}

/**
 * The configured fallback chain as a flat list of language codes.
 *
 * `fallbackLng` is typed as string | string[] | per-language map | fn | false.
 * Only the shapes this app can actually be configured with are resolved; a
 * function or `false` yields no fallbacks, which lands on the same
 * `fallback ?? key` return as before.
 */
function fallbackLanguages(fallbackLng: unknown): string[] {
  if (typeof fallbackLng === 'string') return [fallbackLng];
  if (Array.isArray(fallbackLng)) return fallbackLng.filter(isNonEmptyString);
  if (fallbackLng && typeof fallbackLng === 'object') {
    return Object.values(fallbackLng as Record<string, unknown>)
      .flatMap(value => (Array.isArray(value) ? value : [value]))
      .filter(isNonEmptyString);
  }
  return [];
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
