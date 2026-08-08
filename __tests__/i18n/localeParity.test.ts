import fs from 'fs';
import path from 'path';

/**
 * es/it/sq are checked against en.json, the source of truth.
 *
 * The two directions of drift are not equally serious, so they get separate
 * guarantees:
 *
 * 1. A key a locale defines and en.json does not is always a bug. `t()` is
 *    called with keys that exist in English, so nothing ever resolves to that
 *    entry — it is dead weight left behind by a rename, and it keeps costing
 *    translation and review effort. Hard failure, no allowance.
 *
 * 2. A key en.json defines and a locale does not renders in English through
 *    `fallbackLng: 'en'` (src/i18n/config.ts). That is untranslated, not
 *    broken, so the gap is held at a ceiling rather than at zero: it may
 *    shrink, never grow.
 */
const LOCALES_DIR = path.join(__dirname, '..', '..', 'src', 'i18n', 'locales');

const TRANSLATED_LOCALES = ['es', 'it', 'sq'] as const;
type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];

/**
 * Keys en.json defines that the locale has no entry for.
 *
 * This is a ratchet: lower it, never raise it. Translating keys pushes the
 * real count below the baseline and the suite stays green; adding a key to
 * en.json alone pushes it above and the suite fails, which is the point —
 * either translate it in the same change or make the decision to widen the gap
 * explicit.
 *
 * To lower it after translating: run
 * `npx jest __tests__/i18n/localeParity --verbose`. Each ceiling test names its
 * locale's current count in the test title; copy that number in here.
 */
const MISSING_BASELINE: Record<TranslatedLocale, number> = {
  es: 318,
  it: 318,
  sq: 318,
};

/** Keeps a large drift readable in the failure output. */
const MAX_LISTED = 20;

/** i18next plural suffixes — `t('x', {count})` resolves x_one / x_other / … */
const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_two', '_few', '_many'];

function flatten(node: unknown, prefix = ''): Set<string> {
  const keys = new Set<string>();
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        keys.add(full);
      } else {
        for (const nested of flatten(v, full)) keys.add(nested);
      }
    }
  }
  return keys;
}

/**
 * `items_one`, `items_other` and `items_few` are three forms of one message.
 * i18next selects the form from the target language's own plural rules, so a
 * locale legitimately carries a different SET of forms than English — English
 * needs `_one` / `_other`, a Slavic language also needs `_few`. Comparing raw
 * leaf keys would report each such form twice over: as a key English is
 * missing and as a key the locale added. Collapsing to the base key compares
 * the message, which is the unit a translator actually works in, and lets a
 * locale supply however many forms its grammar requires.
 *
 * A key that merely ends in one of these suffixes without being a plural
 * collapses too, but it collapses identically on both sides, so the comparison
 * stays symmetric.
 */
function baseKey(key: string): string {
  const suffix = PLURAL_SUFFIXES.find(candidate => key.endsWith(candidate));
  return suffix ? key.slice(0, -suffix.length) : key;
}

function loadBaseKeys(locale: string): Set<string> {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  const contents: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Set([...flatten(contents)].map(baseKey));
}

/** `locale -> key` lines, capped, with a count of what was cut. */
function preview(locale: string, keys: string[]): string[] {
  const listed = keys.slice(0, MAX_LISTED).map(key => `${locale} -> ${key}`);
  return keys.length > MAX_LISTED
    ? [...listed, `…and ${keys.length - MAX_LISTED} more`]
    : listed;
}

const englishKeys = loadBaseKeys('en');

const cases = TRANSLATED_LOCALES.map(locale => {
  const localeKeys = loadBaseKeys(locale);
  const missing = [...englishKeys].filter(key => !localeKeys.has(key)).sort();
  return {
    locale,
    missing,
    missingCount: missing.length,
    baseline: MISSING_BASELINE[locale],
    extra: [...localeKeys].filter(key => !englishKeys.has(key)).sort(),
  };
});

describe('locale files against en.json', () => {
  it.each(cases)(
    '$locale defines no key that en.json lacks',
    ({ locale, extra }) => {
      expect(preview(locale, extra)).toEqual([]);
    },
  );

  it.each(cases)(
    '$locale is missing $missingCount key(s) en.json defines (baseline $baseline)',
    ({ locale, missing, baseline }) => {
      // Over the ceiling, fail with the key names rather than a bare count, so
      // it is obvious what there is to translate.
      if (missing.length > baseline) {
        expect(preview(locale, missing)).toEqual([]);
      }
      expect(missing.length).toBeLessThanOrEqual(baseline);
    },
  );
});
