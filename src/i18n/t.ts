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
  const lng = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const raw = i18n.getResource(lng, 'translation', key);
  if (typeof raw !== 'string') {
    return fallback ?? key;
  }
  return i18n.t(key, { defaultValue: fallback ?? key });
}
