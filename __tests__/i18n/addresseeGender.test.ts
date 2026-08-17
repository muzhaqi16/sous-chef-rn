import fs from 'fs';
import path from 'path';

/**
 * No copy inflects for the gender of the person reading it.
 *
 * The app does not know a user's grammatical gender, does not ask, and should
 * not. Every locale had quietly settled on the masculine form, so roughly half
 * the users were addressed in the wrong gender on every confirmation dialog:
 *
 *   it  "Sei sicuro di voler eliminare questo articolo?"
 *   sq  "Je i sigurt që do ta fshish këtë artikull?"
 *   es  "¡Bienvenido a {{name}}!"
 *
 * The fix was not a gender setting. It was to use constructions with no
 * gendered slot — every one of these languages has one, and they read at least
 * as naturally:
 *
 *   "Sei sicuro di voler X?"   ->  "Vuoi davvero X?"
 *   "Je i sigurt që do ta X?"  ->  "Vërtet dëshiron ta X?"
 *   "¡Bienvenido a X!"         ->  "¡Te damos la bienvenida a X!"
 *
 * That is what scales: no per-user state to thread through, no `context`
 * argument for every call site to remember, and nothing for a new string to get
 * wrong. A gender parameter would need a profile field the app has no business
 * collecting — and in a language with two grammatical genders there is no
 * correct form for a non-binary person anyway, so the parameter cannot be right,
 * only less often wrong.
 *
 * This test is the part that keeps it true. Phrasing neutrally is a discipline
 * nobody can sustain across four locale files; a failing build is not.
 *
 * NOTE: this is about the ADDRESSEE only. An adjective agreeing with a *noun*
 * is different and correct — `Default` is `Predeterminado` for a masculine noun
 * and `Predeterminada` for a feminine one. Those live in per-context keys
 * (`recipes.defaultBadge` vs `storageLocationCard.default`), where the key names
 * the context and the translator picks the form. See
 * `docs/i18n-translator-review.md`.
 */
const LOCALES_DIR = path.join(__dirname, '..', '..', 'src', 'i18n', 'locales');

/**
 * Forms that agree with whoever is being addressed. Each is a predicative
 * adjective or past participle in the second person — the shapes that force a
 * choice the app cannot make.
 *
 * Deliberately narrow. An adjective agreeing with a noun in the sentence is
 * correct and must not be flagged: Spanish `contraseña segura` agrees with
 * `contraseña`, and the elliptical `¿Seguro que quieres…?` is idiomatic and
 * reads as neutral, so neither is matched here.
 */
const ADDRESSEE_GENDERED: Record<string, RegExp[]> = {
  es: [
    /\bestás?\s+(completamente\s+|absolutamente\s+)?segur[oa]\b/i,
    /(?<!la\s)\bbienvenid[oa]\s+(a|al)\b/i,
    /^¡?bienvenid[oa]\b/i,
    /\bhas\s+sido\s+(invitad[oa]|añadid[oa]|eliminad[oa])\b/i,
    /\bestás\s+(conectad[oa]|registrad[oa]|invitad[oa])\b/i,
  ],
  it: [
    /\bsei\s+(assolutamente\s+|davvero\s+)?sicur[oa]\b/i,
    /(?<!il\s)\bbenvenut[oa]\s+(in|a)\b/i,
    /^benvenut[oa]\b/i,
    /\bsei\s+stat[oa]\s+\w+[oa]\b/i,
    /\bsei\s+(invitat[oa]|conness[oa]|registrat[oa]|pront[oa])\b/i,
  ],
  sq: [
    /\bje\s+[ie]\s+sigurt\b/i,
    /\bje\s+tërësisht\s+[ie]\s+sigurt\b/i,
    /\bje\s+ftuar\b/i,
    /\bje\s+[ie]\s+(lidhur|regjistruar|mirëpritur)\b/i,
  ],
};

/**
 * Strings that match a pattern above but are correct, each with the reason.
 * Empty today — kept so a genuine exception is recorded rather than the pattern
 * being weakened for everyone.
 */
const ALLOWED: ReadonlyArray<{ locale: string; key: string; reason: string }> =
  [];

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

const isAllowed = (locale: string, key: string) =>
  ALLOWED.some(a => a.locale === locale && a.key === key);

describe('copy does not inflect for the reader’s gender', () => {
  it.each(Object.keys(ADDRESSEE_GENDERED))('%s', locale => {
    const strings = read(locale);
    const patterns = ADDRESSEE_GENDERED[locale];

    const offenders = Object.entries(strings)
      .filter(([key]) => !isAllowed(locale, key))
      .filter(([, value]) => patterns.some(p => p.test(value)))
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

    expect(offenders).toEqual([]);
  });

  it('the patterns still match the forms they were written for', () => {
    // A regex that stopped matching would make every assertion above pass
    // vacuously — and these are non-ASCII patterns where a stray `\b` really
    // does silently stop matching (it did, on Albanian `të`, while this was
    // being written).
    const samples: Array<[string, string]> = [
      ['es', '¿Estás completamente seguro?'],
      ['es', '¡Bienvenido a Casa!'],
      ['it', 'Sei sicuro di voler eliminare questo articolo?'],
      ['it', 'Benvenuto in Casa!'],
      ['sq', 'Je i sigurt që do ta fshish këtë artikull?'],
      ['sq', 'Je ftuar!'],
    ];

    const missed = samples.filter(
      ([locale, text]) => !ADDRESSEE_GENDERED[locale].some(p => p.test(text)),
    );

    expect(missed).toEqual([]);
  });

  it('the neutral replacements are not themselves flagged', () => {
    // The rewrite has to survive its own guard, or the next person "fixes" it
    // back.
    const replacements: Array<[string, string]> = [
      ['es', '¿Seguro que quieres continuar?'],
      ['es', '¡Te damos la bienvenida a Casa!'],
      ['it', 'Vuoi davvero eliminare questo articolo?'],
      ['it', 'Ti diamo il benvenuto in Casa!'],
      ['sq', 'Vërtet dëshiron ta fshish këtë artikull?'],
      ['sq', 'Ke marrë një ftesë!'],
    ];

    const falsePositives = replacements.filter(([locale, text]) =>
      ADDRESSEE_GENDERED[locale].some(p => p.test(text)),
    );

    expect(falsePositives).toEqual([]);
  });
});
