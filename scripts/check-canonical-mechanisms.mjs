#!/usr/bin/env node
/**
 * Fails when a file reaches for an alternative to a documented canonical
 * mechanism.
 *
 * ## Why a script rather than lint rules
 *
 * Every concern here COULD be a `no-restricted-imports` entry, and the ones
 * that reach zero should become one. Today they carry 80-odd outliers between
 * them, and expressing those in `.eslintrc.js` means an `overrides` block per
 * concern plus a matching entry in `restrictedImportsAreNotDropped.test.ts` —
 * roughly 300 lines of allowlist guarding 300 lines of rule, in a config whose
 * own docblock warns that an override silently replaces what it does not
 * restate.
 *
 * One baseline per concern says the same thing in a form that can only shrink,
 * and the promotion path is explicit: when a concern's list empties, delete it
 * here and add the ban to `RESTRICTED_IMPORT_PATHS`, where ESLint will keep it
 * at zero for free.
 *
 * ## What each concern is
 *
 * Not style. Each alternative loses something the canonical path already
 * solved — a theme that follows the colour scheme, a locale that follows the
 * language, a scroll container that arbitrates gestures, a permission prompt
 * that handles the twice-denied case.
 *
 *   node scripts/check-canonical-mechanisms.mjs           # check
 *   node scripts/check-canonical-mechanisms.mjs --list    # print every finding
 *   node scripts/check-canonical-mechanisms.mjs --update  # re-baseline
 *   node scripts/check-canonical-mechanisms.mjs --self-test
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
  fromRoot('scripts/check-canonical-mechanisms.baseline.json'),
);

const SCAN_GLOBS = ['src/**/*.{ts,tsx}'];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
  /\.d\.ts$/,
];

/** A named import of `name` from `module`. */
const importsName = (module, name) =>
  new RegExp(
    `import\\s*(?:type\\s*)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]${module}['"]`,
  );

/** Any import from a module (exact, or a subpath). */
const importsFrom = module =>
  new RegExp(`from\\s*['"]${module}(?:/[^'"]*)?['"]`);

/**
 * Each concern: what the canonical mechanism is, what an alternative looks
 * like, and which files are allowed to hold the alternative because they ARE
 * the canonical mechanism.
 */
export const CONCERNS = [
  {
    id: 'list-primitive',
    canonical: 'FlashList, with an explicit renderScrollComponent',
    why: 'RN lists do not participate in the gesture arbitration the swipeable rows need.',
    detect: importsName('react-native', '(FlatList|SectionList)'),
    owns: [],
  },
  {
    id: 'image-component',
    canonical: 'CachedImage from #components/atoms/CachedImage',
    why: 'The wrapper owns caching, the recycling key and the placeholder.',
    detect: importsName('react-native', 'Image'),
    owns: [/^src\/components\/atoms\/CachedImage\.tsx$/],
  },
  {
    id: 'modal-surface',
    canonical: 'BottomSheetModal via useStandardBottomSheet, or alertService',
    why: "RN's Modal bypasses the global backdrop claim, so the tab bar stays lit under it.",
    detect: importsName('react-native', 'Modal'),
    owns: [
      /^src\/components\/providers\/AlertProvider\.tsx$/,
      /^src\/components\/organisms\/SpotlightCoachMark\//,
      /^src\/components\/molecules\/FormSelect\.tsx$/,
    ],
  },
  {
    id: 'date-formatting',
    canonical: 'the shared formatters in src/utils (dateUtils, dateLocale)',
    why: 'A direct format() call takes no locale, so the date stays English after a language change.',
    detect: importsFrom('date-fns'),
    owns: [/^src\/utils\//],
  },
  {
    id: 'device-storage',
    canonical: 'a persisted slice of the Zustand store',
    why: 'A direct key-value read is invisible to the session-scoped reset, so it survives a sign-out.',
    detect: /from\s*['"]#\/?storage\/mmkv['"]/,
    owns: [/^src\/storage\//, /^src\/store\//, /^src\/apollo\//],
  },
];

const violations = (rel, source) =>
  CONCERNS.filter(
    concern =>
      !concern.owns.some(re => re.test(rel)) && concern.detect.test(source),
  ).map(concern => concern.id);

if (process.argv.includes('--self-test')) {
  const cases = [
    [
      'src/features/x/B.tsx',
      "import { format } from 'date-fns';",
      ['date-formatting'],
    ],
    ['src/utils/dateUtils.ts', "import { format } from 'date-fns';", []],
    // Reaching the instance for something other than translating is fine.
    ['src/store/index.ts', 'getI18n().changeLanguage(x)', []],
    [
      'src/features/x/D.tsx',
      "import { Text } from '#components/atoms/Text';",
      [],
    ],
  ];
  let failed = false;
  for (const [rel, source, expected] of cases) {
    const got = violations(rel, source);
    if (got.sort().join(',') !== [...expected].sort().join(',')) {
      console.error(
        `✗ Self-test failed for ${rel}: expected [${expected}], got [${got}].`,
      );
      failed = true;
    }
  }
  const ids = new Set(CONCERNS.map(c => c.id));
  if (ids.size !== CONCERNS.length) {
    console.error('✗ Self-test failed: a concern id is duplicated.');
    failed = true;
  }
  if (failed) process.exit(2);
  console.log(
    `✓ Self-test passed: ${CONCERNS.length} concerns detect their alternative,\n` +
      '  and the module that IS the canonical mechanism is not a finding.',
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
  check: 'check-canonical-mechanisms',
  hint: 'src/ moved, or the glob no longer matches',
  minimum: 200,
});

/** `<concern>::<file>` — one entry per pair, so a file can shrink one at a time. */
const findings = [];
for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  for (const id of violations(rel, readFileSync(file, 'utf8'))) {
    findings.push(`${id}::${rel}`);
  }
}

const current = [...findings].sort();

if (flags.list) {
  for (const concern of CONCERNS) {
    const hits = current
      .filter(f => f.startsWith(`${concern.id}::`))
      .map(f => f.split('::')[1]);
    console.log(`\n${concern.id} (${hits.length}) — use ${concern.canonical}`);
    console.log(`    ${concern.why}`);
    for (const rel of hits) console.log(`      ${rel}`);
  }
  console.log(
    `\n${current.length} file/concern pair(s) across ${files.length} files.`,
  );
  process.exit(0);
}

const recorded = BASELINE.exists() ? BASELINE.read().pairs ?? [] : [];

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-canonical-mechanisms',
  });
  const byConcern = Object.fromEntries(
    CONCERNS.map(c => [
      c.id,
      current.filter(f => f.startsWith(`${c.id}::`)).length,
    ]),
  );
  BASELINE.write({
    pairs: current,
    countsByConcern: byConcern,
    scannedFiles: files.length,
  });
  console.log(
    `Recorded ${current.length} pair(s): ` +
      Object.entries(byConcern)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${id} ${n}`)
        .join(', '),
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-canonical-mechanisms');
const { added, removed } = diffSets(current, baseline.pairs ?? []);

if (added.length) {
  console.error(
    `\n✗ check-canonical-mechanisms: ${added.length} new use(s) of a non-canonical mechanism.\n`,
  );
  for (const pair of added) {
    const [id, rel] = pair.split('::');
    const concern = CONCERNS.find(c => c.id === id);
    console.error(`    ${id.padEnd(20)} ${rel}`);
    console.error(`    ${''.padEnd(20)} use ${concern.canonical}`);
  }
  console.error(
    `\n  Each of these has one canonical mechanism, and the alternative loses\n` +
      `  what it already solves. See CLAUDE.md and docs/development.md.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-canonical-mechanisms: ${removed.length} baselined use(s) are gone.\n`,
  );
  for (const pair of removed) console.error(`    ${pair.replace('::', '  ')}`);
  console.error(
    `\n  Record it: node scripts/check-canonical-mechanisms.mjs --update\n` +
      `  When a concern reaches zero, delete it here and add the ban to\n` +
      `  RESTRICTED_IMPORT_PATHS in .eslintrc.js instead.\n`,
  );
  process.exit(1);
}

console.log(
  `check-canonical-mechanisms: ${current.length} non-canonical use(s) across ` +
    `${CONCERNS.length} concerns, baseline ${baseline.pairs?.length ?? 0}.`,
);
