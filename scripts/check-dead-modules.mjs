#!/usr/bin/env node
/**
 * Fails when a module under `src/` has no production importer.
 *
 * ## Why a check
 *
 * Dead code does not announce itself. It compiles, it lints, and its own tests
 * pass — which is exactly what keeps it alive: a module whose only remaining
 * reference is `import { X } from './X'` inside `__tests__/X.test.ts`, or a
 * `jest.mock('…/X')` left behind when the last real consumer was deleted.
 *
 * That is how 20 modules survived here, including a 380-line `BiometricManager`
 * superseded by the keychain path, a whole `InteractiveSwipeHint/` tutorial
 * nothing rendered, and three `atoms` (`Card`, `Divider`, `Notification`) that
 * had outlived their callers. Together they were ~2,500 lines that every reader
 * had to treat as live.
 *
 * ## What counts as a reference
 *
 * A `from` / `import()` / `require()` in a NON-test file. Deliberately not:
 *
 * - an import inside a test file — a test for dead code is dead too;
 * - a `jest.mock('…')` — mocking a module is not using it.
 *
 * ## The blind spot, stated
 *
 * A module reached by something other than an import is invisible here. The
 * two in this repo are covered elsewhere, and both must stay that way:
 *
 * - `__mocks__/` and `*.ios|android` files resolve by CONVENTION (jest, Metro),
 *   so they are skipped outright.
 * - Detox reaches components by testID STRING, never by import. Deleting a
 *   component only e2e used would pass this check and fail
 *   `__tests__/harness/e2eTestIdsExist.test.ts`. That is the backstop; it
 *   caught exactly this during the sweep above.
 *
 * The baseline is EMPTY and stays empty: unlike a ratchet that tracks a debt
 * being paid down, there is no legitimate steady state with dead code in it.
 *
 *   node scripts/check-dead-modules.mjs          # check
 *   node scripts/check-dead-modules.mjs --list   # print findings with referrers
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { parseFlags, REPO_ROOT, requireNonEmptyScan } from './lib/tooling.mjs';

const ALIASES = [
  ['#components/', 'src/components/'],
  ['#features/', 'src/features/'],
  ['#hooks/', 'src/hooks/'],
  ['#store/', 'src/store/'],
  ['#services/', 'src/services/'],
  ['#navigation/', 'src/navigation/'],
  ['#constants/', 'src/constants/'],
  ['#context/', 'src/context/'],
  ['#utils/', 'src/utils/'],
  ['#screens/', 'src/screens/'],
  ['#generated/', 'src/graphql/generated/'],
  ['#operations/', 'src/graphql/operations/'],
  ['#storage/', 'src/storage/'],
  ['#config/', 'src/config/'],
  ['#theme/', 'src/theme/'],
  ['#assets/', 'src/assets/'],
  ['#/', 'src/'],
];
const toRepoPath = spec => {
  for (const [alias, real] of ALIASES) {
    if (spec.startsWith(alias)) return real + spec.slice(alias.length);
  }
  return null;
};
const stripExt = p => p.replace(/\.(tsx?|jsx?)$/, '').replace(/\/index$/, '');

const SPEC =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*|jest\.mock\(\s*)(['"])([^'"]+)\1/g;
const MOCK = /jest\.mock\(\s*(['"])([^'"]+)\1/g;
const IS_TEST = /__tests__|\.test\.|__mocks__|jest\.setup/;
/** Resolved by jest / Metro convention, never named in an import. */
const CONVENTION = /(__mocks__\/|\.(ios|android|web|native)\.tsx?$)/;
/** Loaded by the app shell or by codegen, not by a src/ import. */
const ENTRY = new RegExp(
  [
    '^src/(features|app)/[^/]+/(manifest|registry)\\.ts$',
    'screens/registration\\.ts$',
    '^src/features/registry\\.ts$',
    '^src/i18n/',
    '^src/theme/unistyles\\.ts$',
    '^src/types/',
    '^src/apollo/config\\.ts$',
    '^src/services/performance/(startupClock|armStartupProfiling)\\.ts$',
    '^src/native/',
  ].join('|'),
);

const flags = parseFlags({ list: { type: 'boolean', default: false } });

// The filesystem, not `git ls-files`: an uncommitted move makes git's index a
// stale view of where modules actually live, and this check would then report
// every moved file as dead.
const files = execFileSync(
  'find',
  ['src', '__tests__', 'e2e', 'App.tsx', 'index.js', '-type', 'f'],
  { cwd: REPO_ROOT, encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

const modules = files.filter(
  f =>
    /^src\/.*\.(ts|tsx)$/.test(f) &&
    !/\.generated\.ts$/.test(f) &&
    !/\.d\.ts$/.test(f) &&
    !IS_TEST.test(f) &&
    !/__perf__/.test(f) &&
    !CONVENTION.test(f) &&
    !ENTRY.test(f),
);

requireNonEmptyScan({
  count: modules.length,
  what: 'modules',
  check: 'check-dead-modules',
  hint: 'the find(1) roots or the src/ layout changed',
  minimum: 200,
});

const importers = new Map();
for (const file of files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f))) {
  const full = resolve(REPO_ROOT, file);
  if (!existsSync(full)) continue;
  const source = readFileSync(full, 'utf8');
  if (IS_TEST.test(file)) continue;
  const mocked = new Set([...source.matchAll(MOCK)].map(m => m[2]));
  for (const [, , spec] of source.matchAll(SPEC)) {
    if (mocked.has(spec)) continue;
    const target = spec.startsWith('.')
      ? relative(REPO_ROOT, resolve(dirname(full), spec))
      : toRepoPath(spec);
    if (!target) continue;
    const key = stripExt(target);
    if (!importers.has(key)) importers.set(key, new Set());
    importers.get(key).add(file);
  }
}

const dead = modules.filter(f => {
  const key = stripExt(f);
  const refs = importers.get(key);
  return !refs || [...refs].every(r => stripExt(r) === key);
});

if (flags.list || dead.length) {
  for (const f of dead) console.log(`  ${f}`);
}

if (dead.length) {
  console.error(
    `\n✗ check-dead-modules: ${dead.length} module(s) have no production importer.\n\n` +
      `  A module referenced only by its own test, or only by a jest.mock(), is\n` +
      `  dead — the test is dead with it. Delete both.\n\n` +
      `  If it IS reached some other way, say how in the file and add its path to\n` +
      `  the ENTRY list in this script. Detox testID references are already\n` +
      `  covered by __tests__/harness/e2eTestIdsExist.test.ts.\n`,
  );
  process.exit(1);
}

console.log(
  `check-dead-modules: every one of ${modules.length} modules has a production importer.`,
);
