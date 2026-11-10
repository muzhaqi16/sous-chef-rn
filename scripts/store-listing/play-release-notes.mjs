#!/usr/bin/env node
// Writes the release notes a Play promotion sends, from listing.json, in the
// layout fastlane's supply reads: <out>/<play locale>/changelogs/<code>.txt.
// Refuses notes recorded for another version (`_playReleaseNotesFor`), missing
// notes, and notes over Play's limit, so a promotion never ships stale copy.
//
// Usage: node scripts/store-listing/play-release-notes.mjs \
//          --version 4.10.0 --code 216 --out <dir> [--listing <path>]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const PLAY_NOTES_LIMIT = 500;

const fail = message => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const { values } = parseArgs({
  options: {
    version: { type: 'string' },
    code: { type: 'string' },
    out: { type: 'string' },
    listing: { type: 'string' },
  },
});

const { version, code, out } = values;
if (!version || !code || !out) {
  fail(
    'Usage: play-release-notes.mjs --version <name> --code <version code> --out <dir>',
  );
}
if (!/^\d+$/.test(code)) fail(`--code must be a version code, not "${code}"`);

const listingPath =
  values.listing ??
  join(dirname(fileURLToPath(import.meta.url)), 'listing.json');
const listing = JSON.parse(readFileSync(listingPath, 'utf8'));

if (listing._playReleaseNotesFor !== version) {
  fail(
    `listing.json's Play notes are for ${
      listing._playReleaseNotesFor ?? 'no version'
    }, not ${version}. ` +
      `Write the notes for ${version} and set _playReleaseNotesFor to "${version}".`,
  );
}

const files = [];
const problems = [];
// A language Play does not list is recorded as a string, not a locale list.
for (const [language, locales] of Object.entries(
  listing._storeLanguages?.play ?? {},
)) {
  if (!Array.isArray(locales)) continue;
  const notes = listing[language]?.play?.releaseNotes ?? '';
  if (notes.trim() === '') {
    problems.push(`${language}: no Play release notes`);
  } else if (notes.length > PLAY_NOTES_LIMIT) {
    problems.push(
      `${language}: ${notes.length} characters, over Play's ${PLAY_NOTES_LIMIT}`,
    );
  } else {
    for (const locale of locales) files.push({ locale, notes });
  }
}

if (files.length === 0 && problems.length === 0) {
  problems.push('listing.json maps no language to a Play locale');
}
if (problems.length > 0) fail(problems.join('\n  '));

for (const { locale, notes } of files) {
  const dir = join(out, locale, 'changelogs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${code}.txt`), notes);
}

console.log(
  `✓ Play release notes for ${version} (${code}): ${files
    .map(f => f.locale)
    .join(', ')}`,
);
