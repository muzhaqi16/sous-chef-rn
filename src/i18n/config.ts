/**
 * i18next configuration.
 *
 * Initializes the singleton `i18next` instance used throughout the app via
 * `t()` from `'#/i18n'` and the `useTranslation()` hook from `'react-i18next'`.
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
 *
 * Plural categories are completed automatically — see
 * `completePluralCategories` below — so a new locale needing `few`, `many` or
 * `zero` does not need those forms written by hand before it works.
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
 * Fill every CLDR plural category a locale needs but its JSON does not define,
 * copying the `_other` form.
 *
 * A missing category is NOT a graceful degradation in i18next. Verified against
 * the installed `i18next@26`: asking for a count in a category the resource
 * lacks does not fall back to that locale's `_other` — it falls through to
 * `fallbackLng`, so an Italian user sees ENGLISH:
 *
 *   it, count 1_000_000, no `_many` defined  ->  "1000000 items"
 *
 * English and Albanian need `one` and `other`; Spanish and Italian also need
 * `many`, which CLDR selects only for exact millions. Nothing this app counts —
 * items, tags, filters, reviews, members, days — reaches that, so the 82 hand-
 * written `_many` strings it would otherwise take could never render. Deriving
 * them costs nothing, cannot be forgotten, and extends to any locale added
 * later (Polish needs `few`; Arabic needs `zero`, `two`, `few` and `many`).
 *
 * A translator who wants a distinct form still writes `key_many` explicitly —
 * this only fills what is absent.
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
 * The CLDR plural categories a locale needs, or none if the engine cannot say.
 *
 * Hermes does not ship `Intl.PluralRules` on every platform and build, and this
 * runs at module load — an unguarded `new Intl.PluralRules(...)` there is not a
 * degraded translation, it is a red screen before React starts
 * (`[runtime not ready]: TypeError: undefined cannot be used as a
 * constructor`). Caught on the simulator; every Jest test passed, because Node
 * has full Intl.
 *
 * Returning none is the correct answer rather than a shrug: i18next guards the
 * very same call (`PluralResolver.getRule`) and falls back to a rule whose
 * `pluralCategories` are `['one', 'other']`, so without `Intl.PluralRules`
 * nothing beyond those two can ever be selected and there is no gap to fill.
 * The app and the library degrade together.
 *
 * Matches the existing Intl handling in `src/utils/formatters/number.ts`.
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
      // The product name reaches copy as `{{appName}}` rather than being typed
      // into each translation. It appeared literally in six strings per locale,
      // so a rebrand meant editing all four locale files and hoping none was
      // missed — and a missed one shows the OLD product name to users.
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
