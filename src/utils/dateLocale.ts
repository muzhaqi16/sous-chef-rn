import type { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { it } from 'date-fns/locale/it';
import { sq } from 'date-fns/locale/sq';
import { getResolvedLanguage } from '#/i18n';
import type { SupportedLanguage } from '#/i18n/config';

// Anything the app does not ship (or a region-suffixed tag like `en-US`) falls
// back to en-US.
const DATE_FNS_LOCALES: Record<SupportedLanguage, Locale> = {
  en: enUS,
  es,
  it,
  sq,
};

/**
 * The `locale` option for date-fns formatters. Reads the LIVE i18n language, so
 * a component re-rendering on a language change picks up the new locale.
 */
export function getDateFnsLocale(): Locale {
  const language = getResolvedLanguage();
  return isShippedLanguage(language) ? DATE_FNS_LOCALES[language] : enUS;
}

// Own keys only, so an inherited name like `constructor` is not a language.
function isShippedLanguage(language: string): language is SupportedLanguage {
  return Object.prototype.hasOwnProperty.call(DATE_FNS_LOCALES, language);
}
