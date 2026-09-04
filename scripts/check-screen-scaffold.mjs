#!/usr/bin/env node
/**
 * Fails when a screen builds its own chrome instead of taking the scaffold's.
 *
 * ## Why a check
 *
 * 67 screens obtained their chrome through ten mechanisms and six header
 * implementations, and the horizontal gutter was split evenly between two
 * values. `templates/Screen.tsx` owns all of it now — header, insets, gutter,
 * keyboard host, refresh control and the loading/empty/error slots — so a
 * screen supplies content and a variant.
 *
 * ## What each concern is
 *
 *   screen-chrome   a screen imports a header, a safe-area container, a
 *                   keyboard host or a refresh control directly
 *   double-inset    a screen applies the TOP inset itself. The navigator's
 *                   `screenLayout` already does, and applying it twice pushes
 *                   the screen down by a status bar — the defect six profile
 *                   screens carried.
 *
 * `double-inset` is the invariant (its baseline is empty). `screen-chrome` went
 * 28 → 4, and the four left are not debt:
 *
 *   PostLoginBiometricScreen  its group applies no navigator inset (above)
 *   MealPlanMain, RecipeMain  the tab header sits INSIDE their own action row,
 *                             beside a sibling cluster, not in the header slot
 *   NotificationListScreen    its header is a FlashList header, not the screen's
 *
 *   node scripts/check-screen-scaffold.mjs           # check
 *   node scripts/check-screen-scaffold.mjs --list    # print every finding
 *   node scripts/check-screen-scaffold.mjs --update  # re-baseline
 *   node scripts/check-screen-scaffold.mjs --self-test
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
  fromRoot('scripts/check-screen-scaffold.baseline.json'),
);

const SCAN_GLOBS = ['src/features/*/screens/**/*.tsx', 'src/screens/**/*.tsx'];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /\.test\.tsx$/,
  /(^|\/)registration\.ts$/,
];

/**
 * Screens whose navigator group applies NO top inset, so the screen's own is
 * the only one. `RootNavigator`'s Auth, Onboarding and BiometricSetup groups
 * wrap an error boundary and nothing else.
 */
const NO_NAVIGATOR_INSET = [
  'src/features/auth/screens/PostLoginBiometricScreen.tsx',
];

/** Chrome the scaffold owns. A screen importing one of these hand-rolls it. */
const CHROME = [
  /from '#components\/organisms\/Header'/,
  /from '#components\/molecules\/ScreenHeader'/,
  /from '#components\/molecules\/TabScreenHeader'/,
  /\bThemedSafeAreaView\b/,
  /\bSafeAreaView\b/,
  /\bKeyboardAwareScrollView\b/,
  /\bRefreshControl\b/,
];

/** Applying the top inset, which the navigator has already applied. */
const TOP_INSET = [
  /\binsets\.top\b/,
  /\bedges=\{\[[^\]]*'top'/,
  /useSafeAreaInsets\(\)[^\n]*\.top/,
];

/** A `SafeAreaView` with no `edges` defaults to ALL of them, top included. */
const BARE_SAFE_AREA =
  /<(?:Themed)?SafeAreaView\b(?![^<>]*\bedges=)((?:[^<>]|\{[^{}]*\})*?)>/;

export const chromeHits = source => CHROME.filter(re => re.test(source)).length;
export const topInsetHits = source =>
  TOP_INSET.filter(re => re.test(source)).length +
  (BARE_SAFE_AREA.test(source) ? 1 : 0);

const CONCERNS = [
  {
    id: 'screen-chrome',
    count: chromeHits,
    fix: 'render through `Screen` and give it a header variant',
  },
  {
    id: 'double-inset',
    count: topInsetHits,
    fix: 'drop it — the navigator applies the top inset',
  },
];

if (process.argv.includes('--self-test')) {
  const cases = [
    [
      "import { Header } from '#components/organisms/Header';",
      'screen-chrome',
      1,
    ],
    ['const x = <SafeAreaView />;', 'screen-chrome', 1],
    [
      "import { Screen } from '#components/templates/Screen';",
      'screen-chrome',
      0,
    ],
    ['const pad = insets.top;', 'double-inset', 1],
    ['const pad = insets.bottom;', 'double-inset', 0],
    ["<SafeAreaView edges={['top', 'bottom']} />", 'double-inset', 1],
    // No `edges` means every edge, so a bare one applies the top inset too.
    ['<SafeAreaView style={s.a}>{x}</SafeAreaView>', 'double-inset', 1],
    [
      "<SafeAreaView edges={['left', 'right']}>{x}</SafeAreaView>",
      'double-inset',
      0,
    ],
  ];
  let failed = false;
  for (const [source, id, expected] of cases) {
    const got = CONCERNS.find(c => c.id === id).count(source);
    if (got !== expected) {
      console.error(
        `✗ Self-test failed (${id}) for ${JSON.stringify(
          source,
        )}: expected ${expected}, got ${got}.`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(2);
  console.log(
    '✓ Self-test passed: hand-rolled chrome and a self-applied top inset are\n' +
      '  each detected, and the scaffold itself is not a finding.',
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
  what: 'screens',
  check: 'check-screen-scaffold',
  hint: 'the screens globs no longer match',
  minimum: 30,
});

const counts = {};
for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  const source = readFileSync(file, 'utf8');
  for (const concern of CONCERNS) {
    if (concern.id === 'double-inset' && NO_NAVIGATOR_INSET.includes(rel))
      continue;
    const n = concern.count(source);
    if (n > 0) counts[`${concern.id}::${rel}`] = n;
  }
}

if (flags.list) {
  for (const concern of CONCERNS) {
    const hits = Object.entries(counts).filter(([k]) =>
      k.startsWith(`${concern.id}::`),
    );
    console.log(`\n${concern.id} — ${hits.length} screen(s)`);
    console.log(`    ${concern.fix}`);
    for (const [key, n] of hits)
      console.log(`      ${n}  ${key.split('::')[1]}`);
  }
  process.exit(0);
}

if (flags.update) {
  const recorded = BASELINE.exists() ? BASELINE.read().counts ?? {} : {};
  refuseEmptyBaselineUpdate({
    count: Object.keys(counts).length,
    baselineCount: Object.keys(recorded).length,
    check: 'check-screen-scaffold',
  });
  BASELINE.write({ counts, scannedFiles: files.length });
  console.log(`Recorded ${Object.keys(counts).length} finding(s).`);
  process.exit(0);
}

const baseline = BASELINE.require('check-screen-scaffold');
const recorded = baseline.counts ?? {};

const grew = Object.entries(counts).filter(([k, n]) => n > (recorded[k] ?? 0));
const { removed } = diffSets(Object.keys(counts), Object.keys(recorded));

if (grew.length) {
  console.error(
    `\n✗ check-screen-scaffold: ${grew.length} screen(s) build their own chrome.\n`,
  );
  for (const [key, n] of grew) {
    const [id, rel] = key.split('::');
    console.error(
      `    ${id.padEnd(14)} ${rel}  (${recorded[key] ?? 0} → ${n})`,
    );
    console.error(
      `    ${''.padEnd(14)} ${CONCERNS.find(c => c.id === id).fix}`,
    );
  }
  console.error(
    '\n  `templates/Screen.tsx` owns the header, the insets, the gutter, the\n' +
      '  keyboard host, the refresh control and the state slots.\n',
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-screen-scaffold: ${removed.length} baselined screen(s) adopted the scaffold.\n`,
  );
  for (const key of removed) console.error(`    ${key.replace('::', '  ')}`);
  console.error(
    '\n  Record it: node scripts/check-screen-scaffold.mjs --update\n',
  );
  process.exit(1);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(
  `check-screen-scaffold: ${total} finding(s) across ${
    Object.keys(counts).length
  } ` +
    `screens, baseline ${Object.values(recorded).reduce((a, b) => a + b, 0)}.`,
);
