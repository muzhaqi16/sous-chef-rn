import { MESSAGES } from '#constants/messages';

/**
 * Lightweight translation helper — wraps MESSAGES with dot-path access.
 *
 * Usage: `t('errors.addItemFailed')` instead of `MESSAGES.errors.addItemFailed`
 *
 * This is a stepping stone: when react-i18next is adopted, swap the
 * implementation to `useTranslation().t` — all call sites stay unchanged.
 *
 * @param key Dot-path key matching the MESSAGES object structure
 * @param fallback Returned if the key doesn't resolve
 */
export function t(key: string, fallback?: string): string {
  const parts = key.split('.');
  let current: unknown = MESSAGES;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return fallback ?? key;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : fallback ?? key;
}
