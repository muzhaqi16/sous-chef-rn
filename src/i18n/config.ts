/**
 * Initializes the singleton i18next instance. MUST be imported at app startup
 * (see `index.js`) before anything that calls `t()`. Adding a locale means a
 * JSON file under `src/i18n/locales/` plus an entry in `resources`; plural
 * categories are completed automatically by `completePluralCategories`.
 */
import { appConfig } from '#/config/appConfig';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import sq from './locales/sq.json';
import it from './locales/it.json';
import es from './locales/es.json';
import { mergeFeatureLocales } from './featureLocales';

type ResourceNode = { [key: string]: string | ResourceNode };

/**
 * Fill every CLDR category a locale needs but does not define, copying `_other`.
 * A missing category does NOT fall back to that locale's own `_other` — it
 * falls through to `fallbackLng`, so an Italian user reading a count of
 * 1,000,000 sees English. Only fills what is absent.
 */
function completePluralCategories(resources: Record<string, ResourceNode>) {
  for (const [locale, tree] of Object.entries(resources)) {
    const needed = neededPluralCategories(locale);
    if (needed.length === 0) continue;

    const fill = (node: ResourceNode) => {
      for (const [key, value] of Object.entries(node)) {
        if (typeof value !== 'string') {
          fill(value);
          continue;
        }
        const base = key.match(/^(.*)_other$/)?.[1];
        if (base === undefined) continue;
        for (const category of needed) {
          const target = `${base}_${category}`;
          if (!(target in node)) node[target] = value;
        }
      }
    };

    fill(tree);
  }
  return resources;
}

/**
 * The CLDR categories a locale needs, or none when the engine cannot say. Hermes
 * lacks `Intl.PluralRules` on some builds and this runs at module load, so an
 * unguarded constructor is a red screen before React starts — invisible to Jest.
 * None is CORRECT: i18next guards the same call and falls back to one/other.
 */
function neededPluralCategories(locale: string): readonly string[] {
  let rules: Intl.PluralRules;
  try {
    rules = new Intl.PluralRules(locale);
  } catch {
    return [];
  }
  return rules.resolvedOptions().pluralCategories;
}

// Core copy plus each feature's own, so a feature's strings live with the
// feature and travel with it. `mergeFeatureLocales` is the only place the two
// halves meet; `scripts/check-i18n.mjs` checks parity across the merged trees.
const resources = completePluralCategories({
  en: mergeFeatureLocales('en', en) as ResourceNode,
  sq: mergeFeatureLocales('sq', sq) as ResourceNode,
  it: mergeFeatureLocales('it', it) as ResourceNode,
  es: mergeFeatureLocales('es', es) as ResourceNode,
});

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources: {
      en: { translation: resources.en },
      sq: { translation: resources.sq },
      it: { translation: resources.it },
      es: { translation: resources.es },
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
      // The product name reaches copy as `{{appName}}`, never typed into a
      // translation — a rebrand would otherwise mean editing all four locale
      // files and a missed one shows the wrong product name.
      defaultVariables: { appName: appConfig.identity.displayName },
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
 * Supported UI languages. `label` is the endonym, so a user sees their language
 * in their own script rather than the active locale's. `value` is the i18next
 * resource key, matching `src/i18n/locales/<value>.json`.
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

/** Switch the active UI language; `useTranslation()` consumers re-render. */
export function changeLanguage(lang: SupportedLanguage): Promise<unknown> {
  return i18next.changeLanguage(lang);
}
