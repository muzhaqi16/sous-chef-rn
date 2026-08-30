import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const CORE_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const FEATURES_DIR = path.join(ROOT, 'src', 'features');

export type LocaleTree = Record<string, unknown>;

const read = (file: string): LocaleTree =>
  JSON.parse(fs.readFileSync(file, 'utf8'));

/** Every feature directory that ships copy, sorted for deterministic merges. */
export const featureLocaleDirs = (): string[] =>
  fs
    .readdirSync(FEATURES_DIR)
    .filter(name =>
      fs.existsSync(path.join(FEATURES_DIR, name, 'locales')),
    )
    .sort();

/**
 * The whole translation tree for a locale: core copy plus every feature's.
 *
 * The app builds this from static imports (`src/i18n/featureLocales.ts`); this
 * builds the same thing from disk, because the gates that read it — key
 * existence, canonical-vocabulary, locale parity — must see what the app sees.
 * Reading only `src/i18n/locales/<locale>.json` would silently check a third of
 * the copy and pass.
 */
export const mergedLocale = (locale: string): LocaleTree => {
  let merged: LocaleTree = read(path.join(CORE_DIR, `${locale}.json`));
  for (const feature of featureLocaleDirs()) {
    const file = path.join(FEATURES_DIR, feature, 'locales', `${locale}.json`);
    if (fs.existsSync(file)) merged = deepMerge(merged, read(file));
  }
  return merged;
};

/**
 * The same namespace-combining merge the app performs. `Object.assign` at the
 * top level made a feature's `labels` REPLACE core's — and because the checkers
 * repeated that mistake, parity still reported clean over a tree the app had
 * silently emptied.
 */
const deepMerge = (base: LocaleTree, incoming: LocaleTree): LocaleTree => {
  const merged: LocaleTree = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = merged[key];
    merged[key] =
      isNamespace(existing) && isNamespace(value)
        ? deepMerge(existing, value)
        : value;
  }
  return merged;
};

const isNamespace = (value: unknown): value is LocaleTree =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
