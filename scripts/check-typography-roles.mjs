#!/usr/bin/env node
/**
 * Fails when text is set by size and weight rather than by a named role, or
 * when a stylesheet outside the theme sets type properties itself.
 *
 * ## Why a check
 *
 * A role carries size, weight, leading and tracking together, so two screens
 * cannot pick different sizes for the same kind of text without saying so. The
 * audit found the opposite: 1,086 text elements, 10 of them role-based, leading
 * derived by five different ratios, and 365 type declarations in stylesheets
 * that the role would otherwise own.
 *
 * ## What each concern is
 *
 *   off-role-text     a `<Text>` outside the kit passing size / weight /
 *                     lineHeight. Inside `src/components/**` these are the
 *                     documented escape hatch; outside it they are a second
 *                     definition of a role that already exists.
 *   stylesheet-type   `fontSize` / `fontWeight` / `lineHeight` in a stylesheet
 *                     outside `src/theme/`. A role sets all three; a stylesheet
 *                     that sets one of them splits the definition in two.
 *
 * Both are ratchets rather than bans because the remainder needs a screenshot
 * review: 778 sites migrated because a role reproduces their size and weight
 * EXACTLY, and the rest snap to the nearest role, which moves pixels. Each is a
 * `no-restricted-syntax` selector the moment its list empties.
 *
 *   node scripts/check-typography-roles.mjs           # check
 *   node scripts/check-typography-roles.mjs --list    # print every finding
 *   node scripts/check-typography-roles.mjs --update  # re-baseline
 *   node scripts/check-typography-roles.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import {
  baselineFile,
  diffSets,
  filesUnder,
  fromRoot,
  parseFlags,
  refuseEmptyBaselineUpdate,
  REPO_ROOT,
  requireNonEmptyScan,
} from './lib/tooling.mjs';

const BASELINE = baselineFile(
  fromRoot('scripts/check-typography-roles.baseline.json'),
);

const SCAN_GLOBS = ['src/**/*.{ts,tsx}'];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
  /\.d\.ts$/,
  /(^|\/)src\/theme\//,
  // The atom that DEFINES the roles and the escape hatches.
  /(^|\/)src\/components\/atoms\/Text\.tsx$/,
];

/** A `<Text …>` opening tag, attributes captured. */
const TEXT_TAG = /<Text\b((?:[^<>]|\{[^{}]*\})*?)\/?>/gs;

const TYPE_PROP = /\b(size|weight|lineHeight)=/;

/** `fontSize:` / `fontWeight:` / `lineHeight:` as a style property. */
const STYLE_TYPE_PROP = /^\s*(fontSize|fontWeight|lineHeight):/m;

export function offRoleText(source, rel) {
  // Inside the kit, an override is the documented escape hatch.
  if (rel.startsWith('src/components/')) return 0;
  let hits = 0;
  for (const match of source.matchAll(TEXT_TAG)) {
    if (TYPE_PROP.test(match[1])) hits += 1;
  }
  return hits;
}

export function stylesheetType(source) {
  return source.split('\n').filter(line => STYLE_TYPE_PROP.test(line)).length;
}

const CONCERNS = [
  {
    id: 'off-role-text',
    fix: 'name a role — `role="caption"` — instead of size and weight',
    count: offRoleText,
  },
  {
    id: 'stylesheet-type',
    fix: 'let the role carry it, or read `theme.type.<role>` for a non-Text element',
    count: (source, rel) =>
      rel.startsWith('src/theme/') ? 0 : stylesheetType(source),
  },
];

if (process.argv.includes('--self-test')) {
  const cases = [
    [
      'src/features/x/A.tsx',
      '<Text size="xs" weight="bold">hi</Text>',
      'off-role-text',
      1,
    ],
    [
      'src/features/x/B.tsx',
      '<Text role="caption">hi</Text>',
      'off-role-text',
      0,
    ],
    // The kit keeps its escape hatch.
    [
      'src/components/atoms/B.tsx',
      '<Text size="xs">hi</Text>',
      'off-role-text',
      0,
    ],
    [
      'src/features/x/C.tsx',
      'const s = {\n  a: {\n    fontSize: theme.fonts.size.sm,\n  },\n};',
      'stylesheet-type',
      1,
    ],
    [
      'src/features/x/D.tsx',
      'const s = {\n  a: {\n    color: theme.colors.textPrimary,\n  },\n};',
      'stylesheet-type',
      0,
    ],
    // A dynamic size still splits the definition.
    [
      'src/features/x/E.tsx',
      '<Text size={big ? "lg" : "sm"}>hi</Text>',
      'off-role-text',
      1,
    ],
  ];
  let failed = false;
  for (const [rel, source, id, expected] of cases) {
    const got = CONCERNS.find(c => c.id === id).count(source, rel);
    if (got !== expected) {
      console.error(
        `✗ Self-test failed for ${rel} (${id}): expected ${expected}, got ${got}.`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(2);
  console.log(
    '✓ Self-test passed: an off-role Text and a stylesheet type property are\n' +
      '  each counted, a role is not, and the kit keeps its escape hatch.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const files = filesUnder(SCAN_GLOBS, { exclude: SKIP });

requireNonEmptyScan({
  count: files.length,
  what: 'source files',
  check: 'check-typography-roles',
  hint: 'src/ moved, or the glob no longer matches',
  minimum: 200,
});

const counts = {};
for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  const source = readFileSync(file, 'utf8');
  for (const concern of CONCERNS) {
    const n = concern.count(source, rel);
    if (n > 0) counts[`${concern.id}::${rel}`] = n;
  }
}

if (flags.list) {
  for (const concern of CONCERNS) {
    const hits = Object.entries(counts).filter(([k]) =>
      k.startsWith(`${concern.id}::`),
    );
    const total = hits.reduce((sum, [, n]) => sum + n, 0);
    console.log(`\n${concern.id} — ${total} in ${hits.length} file(s)`);
    console.log(`    ${concern.fix}`);
    for (const [key, n] of hits.sort((a, b) => b[1] - a[1])) {
      console.log(`      ${String(n).padStart(4)}  ${key.split('::')[1]}`);
    }
  }
  process.exit(0);
}

if (flags.update) {
  const recorded = BASELINE.exists() ? BASELINE.read().counts ?? {} : {};
  refuseEmptyBaselineUpdate({
    count: Object.keys(counts).length,
    baselineCount: Object.keys(recorded).length,
    check: 'check-typography-roles',
  });
  BASELINE.write({ counts, scannedFiles: files.length });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(
    `Recorded ${total} finding(s) across ${
      Object.keys(counts).length
    } file(s).`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-typography-roles');
const recorded = baseline.counts ?? {};

const grew = Object.entries(counts).filter(
  ([key, n]) => n > (recorded[key] ?? 0),
);
const { removed } = diffSets(Object.keys(counts), Object.keys(recorded));

if (grew.length) {
  console.error(
    `\n✗ check-typography-roles: ${grew.length} file(s) set type outside a role.\n`,
  );
  for (const [key, n] of grew) {
    const [id, rel] = key.split('::');
    const concern = CONCERNS.find(c => c.id === id);
    console.error(
      `    ${id.padEnd(18)} ${rel}  (${recorded[key] ?? 0} → ${n})`,
    );
    console.error(`    ${''.padEnd(18)} ${concern.fix}`);
  }
  console.error(
    '\n  A role carries size, weight, leading and tracking together. Setting one\n' +
      '  of them beside it is a second definition of a role that exists.\n',
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-typography-roles: ${removed.length} baselined file(s) are clean now.\n`,
  );
  for (const key of removed) console.error(`    ${key.replace('::', '  ')}`);
  console.error(
    '\n  Record it: node scripts/check-typography-roles.mjs --update\n' +
      '  When a concern reaches zero, replace it with a no-restricted-syntax\n' +
      '  selector in .eslintrc.js and delete its half of the baseline.\n',
  );
  process.exit(1);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
const recordedTotal = Object.values(recorded).reduce((a, b) => a + b, 0);
console.log(
  `check-typography-roles: ${total} off-role declaration(s) across ` +
    `${Object.keys(counts).length} files, baseline ${recordedTotal}.`,
);
