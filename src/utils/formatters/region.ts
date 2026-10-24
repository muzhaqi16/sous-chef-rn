import { isTranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';

/**
 * A country code as its name in the reader's language, else the code. The
 * names are copy (`countries.*`, CLDR's): Hermes has no `Intl.DisplayNames`.
 */
export function formatCountryName(code: string, t: Translate): string {
  const key = `countries.${code}`;
  return isTranslationKey(key) ? t(key) : code;
}
