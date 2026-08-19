import fs from 'fs';
import path from 'path';

/**
 * The same English string must not be translated two ways *for typographic
 * reasons*.
 *
 * When several keys hold the same English sentence, their translations drifted
 * apart: "Unknown Home" was both `Hogar desconocido` and `Hogar Desconocido`,
 * "Shopping List" was `Lista della spesa` and `Lista della Spesa`. Spanish,
 * Italian and Albanian all use sentence case for UI copy — the title-cased
 * variants are an artefact of translating the shape of the English label rather
 * than the label. Likewise `es. 4,99` vs `es., 4,99`, where the comma is carried
 * over from English "e.g.,".
 *
 * **This test deliberately does NOT require the translations to be identical.**
 * Same English does not mean same meaning, and unifying blindly would replace
 * correct translations with wrong ones:
 *
 *   - `Back` is `Atrás` for navigation and `Reverso` for the back of a package
 *   - `Invite` is `Invito` (the noun) and `Invita` (the button)
 *   - `Item` is `Elemento` in a generic error and `Artículo` for a pantry item
 *   - `Default` is `Predeterminado` for a masculine noun and `Predeterminada`
 *     for a feminine one — both correct
 *
 * So the assertion is narrow on purpose: two translations of the same English
 * may differ, but not *only* by capitalisation or punctuation. That difference
 * is never meaning; it is always drift.
 *
 * The remaining genuine differences are listed in
 * `docs/i18n-translator-review.md` for someone who reads the language.
 */
const LOCALES_DIR = path.join(__dirname, '..', '..', 'src', 'i18n', 'locales');
const TRANSLATED = ['es', 'it', 'sq'] as const;

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

const read = (locale: string) =>
  flatten(
    JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8')),
  );

const en = read('en');

const ignoringCase = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const ignoringCaseAndPunctuation = (s: string) =>
  ignoringCase(s)
    .replace(/[.!?,:;…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** English string -> the keys that declare it, for strings with more than one. */
const duplicatedEnglish = (): Array<[string, string[]]> => {
  const byValue = new Map<string, string[]>();
  for (const [key, value] of Object.entries(en)) {
    byValue.set(value, [...(byValue.get(value) ?? []), key]);
  }
  return [...byValue.entries()].filter(([, keys]) => keys.length > 1);
};

describe('translations of the same English string', () => {
  const groups = duplicatedEnglish();

  it('finds duplicated English at all, so the checks below are not vacuous', () => {
    expect(groups.length).toBeGreaterThan(0);
  });

  it.each(TRANSLATED)(
    '%s never differs only by capitalisation',
    locale => {
      const translations = read(locale);
      const offenders: string[] = [];

      for (const [english, keys] of groups) {
        const values = [
          ...new Set(
            keys.map(k => translations[k]).filter((v): v is string => !!v),
          ),
        ];
        if (values.length < 2) continue;
        if (new Set(values.map(ignoringCase)).size === 1) {
          offenders.push(
            `${JSON.stringify(english)} -> ${values.map(v => JSON.stringify(v)).join(' vs ')}`,
          );
        }
      }

      expect(offenders).toEqual([]);
    },
  );

  it.each(TRANSLATED)('%s never differs only by punctuation', locale => {
    const translations = read(locale);
    const offenders: string[] = [];

    for (const [english, keys] of groups) {
      const values = [
        ...new Set(
          keys.map(k => translations[k]).filter((v): v is string => !!v),
        ),
      ];
      if (values.length < 2) continue;
      // Capitalisation-only cases are reported by the test above; this one is
      // about a comma or full stop appearing in one variant and not the other.
      if (new Set(values.map(ignoringCase)).size === 1) continue;
      if (new Set(values.map(ignoringCaseAndPunctuation)).size === 1) {
        offenders.push(
          `${JSON.stringify(english)} -> ${values.map(v => JSON.stringify(v)).join(' vs ')}`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });
});
