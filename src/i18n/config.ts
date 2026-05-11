/**
 * i18next configuration.
 *
 * Initializes the singleton `i18next` instance used throughout the app via
 * `t()` from `'#/i18n/t'` and the `useTranslation()` hook from `'react-i18next'`.
 *
 * **Initialization order:** this module must be imported once at app startup
 * (see `index.js`) BEFORE any React component or service that calls `t()`.
 *
 * **Bundled locales:** English (en), Albanian (sq), Italian (it), Spanish (es).
 * Default language is English; switch at runtime via `i18next.changeLanguage('it')`
 * (or 'sq' / 'es'). Future work: wire device-locale detection via
 * react-native-localize.
 *
 * **Adding a new locale:**
 *   1. Drop the JSON file in `src/i18n/locales/<lang>.json` mirroring `en.json`.
 *   2. Import it here and add it to the `resources` map under the matching key.
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import sq from './locales/sq.json';
import it from './locales/it.json';
import es from './locales/es.json';

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      sq: { translation: sq },
      it: { translation: it },
      es: { translation: es },
    },
    lng: 'en',
    fallbackLng: 'en',
    // Explicit even though v4 is the default in i18next 23+ — keeps intent
    // clear when reading the config and avoids implicit-default surprises
    // on upgrades.
    compatibilityJSON: 'v4',
    interpolation: {
      // React Native renders text directly; React handles XSS escaping itself.
      escapeValue: false,
    },
    react: {
      // The app does not wrap consumers in <Suspense>; defer-render-until-loaded
      // would block the initial paint while resources are already bundled in JS.
      useSuspense: false,
    },
  });
}

// Wrapper getter so consumers don't bypass the side-effectful `init` above by
// importing `i18next` directly and finding it half-configured. Re-exporting the
// imported `i18next` symbol is also blocked by `no-barrel-files`.
export function getI18n() {
  return i18next;
}

/**
 * Supported UI languages. Each entry's `label` is the language's endonym (its
 * own name in its own language) so users see their language in their script,
 * not in the currently-active locale.
 *
 * The `value` is the i18next resource key matching `src/i18n/locales/<value>.json`.
 */
export type SupportedLanguage = 'en' | 'it' | 'es' | 'sq';

interface LanguageOption {
  value: SupportedLanguage;
  label: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'es', label: 'Español' },
  { value: 'sq', label: 'Shqip' },
];

/**
 * Switch the active UI language. Use this from the language-picker UI; it
 * delegates to `i18next.changeLanguage` so all `useTranslation()` consumers
 * re-render with the new strings.
 */
export function changeLanguage(lang: SupportedLanguage): Promise<unknown> {
  return i18next.changeLanguage(lang);
}
