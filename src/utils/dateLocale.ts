import type { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { it } from 'date-fns/locale/it';
import { sq } from 'date-fns/locale/sq';
import { getI18n } from '#/i18n/config';

// The app ships en / es / it / sq; map each to its date-fns locale. Anything
// unmapped (or a region-suffixed tag like `en-US`) falls back to en-US.
const DATE_FNS_LOCALES: Record<string, Locale> = { en: enUS, es, it, sq };

/**
 * The date-fns `Locale` matching the app's active i18n language, to pass as the
 * `locale` option to date-fns formatters (`format`, `formatDistanceToNow`, …)
 * so dates and relative times render in the user's language instead of always
 * in English. Reads the live i18n language, so a component that re-renders on
 * language change (via `useTranslation`) picks up the new locale automatically.
 */
export function getDateFnsLocale(): Locale {
  const i18n = getI18n();
  const lng = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
  return DATE_FNS_LOCALES[lng] ?? enUS;
}
