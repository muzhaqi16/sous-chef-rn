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
  const merged: LocaleTree = read(path.join(CORE_DIR, `${locale}.json`));
  for (const feature of featureLocaleDirs()) {
    const file = path.join(FEATURES_DIR, feature, 'locales', `${locale}.json`);
    if (fs.existsSync(file)) Object.assign(merged, read(file));
  }
  return merged;
};
