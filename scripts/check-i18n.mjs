#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');
const REFERENCE = 'en.json';

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

function load(file) {
  return JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
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
