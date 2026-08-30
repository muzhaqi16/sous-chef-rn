#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');
const FEATURES_DIR = join(__dirname, '..', 'src', 'features');
const REFERENCE = 'en.json';

/**
 * Feature directories that ship their own copy.
 *
 * A feature's strings live with the feature, so parity has to be checked over
 * core PLUS every feature — checking `src/i18n/locales` alone would compare a
 * third of the app's copy and report it consistent.
 */
const featureLocaleDirs = () =>
  readdirSync(FEATURES_DIR)
    .filter(name => existsSync(join(FEATURES_DIR, name, 'locales')))
    .sort();

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out.set(key, v);
    }
  }
  return out;
}

const isNamespace = value =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The same DEEP merge `src/i18n/featureLocales.ts` and `#/test-utils/mergedLocales`
 * perform.
 *
 * `Object.assign` is shallow, so a feature contributing `errors.*` REPLACED the
 * core `errors` namespace outright instead of adding to it — this gate then
 * compared a tree the app never builds, and could report a key as present or
 * missing on the strength of which file happened to declare its namespace last.
 */
function deepMergeLocale(base, incoming) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = merged[key];
    merged[key] =
      isNamespace(existing) && isNamespace(value)
        ? deepMergeLocale(existing, value)
        : value;
  }
  return merged;
}

/** Core copy plus every feature's, for one locale file (e.g. `en.json`). */
function load(file) {
  let merged = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
  for (const feature of featureLocaleDirs()) {
    const path = join(FEATURES_DIR, feature, 'locales', file);
    if (existsSync(path)) {
      merged = deepMergeLocale(merged, JSON.parse(readFileSync(path, 'utf8')));
    }
  }
  return merged;
}

const files = readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'));
if (!files.includes(REFERENCE)) {
  console.error(`Reference locale ${REFERENCE} not found in ${LOCALES_DIR}`);
  process.exit(1);
}

const reference = flatten(load(REFERENCE));
const referenceKeys = new Set(reference.keys());

const failures = [];

for (const file of files) {
  if (file === REFERENCE) continue;
  const locale = flatten(load(file));
  const localeKeys = new Set(locale.keys());

  const missing = [...referenceKeys].filter(k => !localeKeys.has(k));
  const extra = [...localeKeys].filter(k => !referenceKeys.has(k));

  if (missing.length) {
    failures.push(
      `${file}: missing ${missing.length} key(s):\n  - ${missing.join(
        '\n  - ',
      )}`,
    );
  }
  if (extra.length) {
    failures.push(
      `${file}: has ${
        extra.length
      } extra key(s) not in ${REFERENCE}:\n  - ${extra.join('\n  - ')}`,
    );
  }
}

if (failures.length) {
  console.error('i18n key drift detected:\n');
  for (const f of failures) console.error(f, '\n');
  process.exit(1);
}

console.log(
  `✓ i18n keys consistent across ${files.length} locale(s) (${referenceKeys.size} keys each).`,
);
