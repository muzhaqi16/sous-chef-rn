import fs from 'fs';
import path from 'path';
import { getI18n } from '#/i18n/config';

/**
 * Every plural key resolves in every category its locale actually needs.
 *
 * A missing plural category is not a graceful degradation in i18next. Verified
 * against the installed `i18next@26`: a count in a category the resource lacks
 * does not fall back to that locale's `_other` — it falls through to
 * `fallbackLng`, so an Italian user reads ENGLISH:
 *
 *   it, count 1_000_000, no `_many` defined  ->  "1000000 items"
 *
 * Which categories a locale needs is a CLDR fact, not a guess, so this asks
 * `Intl.PluralRules` rather than hardcoding `one`/`other`. English and Albanian
 * need two; Spanish and Italian need three. A locale added later gets checked
 * for whatever IT needs without this file changing — Polish needs `few`, Arabic
 * needs `zero`, `two`, `few` and `many`.
 *
 * The categories are filled from `_other` at load time by
 * `completePluralCategories` in `src/i18n/config.ts`. This test asserts the
 * RESOLVED behaviour rather than the JSON shape, so it covers both the derived
 * forms and any a translator writes by hand.
 */
const LOCALES_DIR = path.join(__dirname, '..', '..', 'src', 'i18n', 'locales');
const LOCALES = ['en', 'es', 'it', 'sq'] as const;

/** One count that CLDR maps to each category, per locale. */
const SAMPLE_FOR_CATEGORY: Record<string, number[]> = {
  zero: [0],
  one: [1],
  two: [2],
  few: [3, 4],
  many: [1_000_000, 2_000_000, 5, 11],
  other: [0, 2, 17, 100],
};

const flatten = (obj: unknown, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else if (value && typeof value === 'object')
      Object.assign(out, flatten(value, full));
  }
  return out;
};

/** Base keys of every plural set declared in en.json. */
const pluralBases = (): string[] => {
  const en = flatten(
    JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8')),
  );
  return [
    ...new Set(
      Object.keys(en)
        .map(k => k.match(/^(.*)_other$/)?.[1])
        .filter((b): b is string => !!b),
    ),
  ];
};

/** A count that `Intl.PluralRules` maps to `category` in `locale`, if one exists. */
const countFor = (locale: string, category: string): number | undefined => {
  const rules = new Intl.PluralRules(locale);
  return (SAMPLE_FOR_CATEGORY[category] ?? []).find(
    n => rules.select(n) === category,
  );
};

describe('plural categories', () => {
  const bases = pluralBases();

  it('finds plural keys at all, so the checks below are not vacuous', () => {
    expect(bases.length).toBeGreaterThan(0);
  });

  it.each(LOCALES)(
    '%s declares the categories CLDR says it needs',
    async locale => {
      const i18n = getI18n();
      await i18n.changeLanguage(locale);

      const needed = new Intl.PluralRules(locale).resolvedOptions()
        .pluralCategories;
      // A locale whose sample counts do not actually produce a category would
      // silently skip it; surface that rather than passing.
      const unsampled = needed.filter(c => countFor(locale, c) === undefined);
      expect(unsampled).toEqual([]);

      // Resource existence, not the rendered string. Comparing output against
      // English gives false positives on loanwords — Italian `tagCount_one` is
      // "{{count}} Tag", identical to English and entirely correct.
      const missing: string[] = [];
      for (const base of bases) {
        for (const category of needed) {
          const key = `${base}_${category}`;
          if (typeof i18n.getResource(locale, 'translation', key) !== 'string') {
            missing.push(`${key} (needed for category "${category}")`);
          }
        }
      }

      expect(missing).toEqual([]);

      // And the resolution actually works for a count in each category.
      const unresolved = bases.flatMap(base =>
        needed
          .map(category => ({ category, count: countFor(locale, category)! }))
          .filter(({ count }) => {
            const value = i18n.t(base, { count });
            return !value || value === base;
          })
          .map(({ category }) => `${base} [${category}] did not resolve`),
      );

      expect(unresolved).toEqual([]);
    },
  );

  it('a locale missing a category it needs would be caught', async () => {
    // The guard has to be able to fail. `it` needs `many`; a resource without
    // it falls through to English, which is the bug this file exists for.
    const i18n = getI18n();
    await i18n.changeLanguage('it');

    const needed = new Intl.PluralRules('it').resolvedOptions().pluralCategories;
    expect(needed).toContain('many');

    // `completePluralCategories` filled it, so the Italian form is what renders.
    const italian = i18n.t('recipes.reviewCount', { count: 1_000_000 });
    const english = i18n.t('recipes.reviewCount', { count: 1_000_000, lng: 'en' });
    expect(italian).not.toBe(english);
  });
});

/**
 * The module must load on an engine without `Intl.PluralRules`.
 *
 * This is not hypothetical. `completePluralCategories` shipped with an
 * unguarded `new Intl.PluralRules(...)` and, because it runs at module load,
 * red-screened the app before React started:
 *
 *   [runtime not ready]: TypeError: undefined cannot be used as a constructor
 *     _loop
 *     completePluralCategories
 *
 * Every unit test passed — Node has full Intl — and typecheck and lint had
 * nothing to say. Only the simulator showed it. Hence this test: it removes
 * `Intl.PluralRules` and re-imports the module, which is the one thing Jest
 * can do that reproduces the device.
 */
describe('i18n config on an engine without Intl.PluralRules', () => {
  const original = Intl.PluralRules;

  afterEach(() => {
    Object.defineProperty(Intl, 'PluralRules', {
      value: original,
      configurable: true,
      writable: true,
    });
    jest.resetModules();
  });

  it('loads without throwing, and translates', () => {
    // @ts-expect-error — deleting a standard global is the point of the test.
    delete Intl.PluralRules;
    expect(Intl.PluralRules).toBeUndefined();

    jest.resetModules();
    // `require`, not dynamic `import()` — this Jest config runs without
    // --experimental-vm-modules, so `import()` rejects rather than loading.
    const config = jest.requireActual<typeof import('#/i18n/config')>(
      '#/i18n/config',
    );

    // Reaching here at all is the assertion: the import must not throw.
    expect(typeof config.getI18n().t('labels.error')).toBe('string');
  });
});
