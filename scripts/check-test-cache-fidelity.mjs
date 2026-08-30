#!/usr/bin/env node
/**
 * Fails when a test reinstates the reduced Apollo cache the suite moved off.
 *
 * ## Why a script and not a test
 *
 * This started as the last `it()` in
 * `__tests__/apollo/testCacheIsTheProductionCache.test.ts`, and as a test it
 * had four ways to be quietly wrong:
 *
 * - it identified its subjects by grepping for the strings `renderWithApollo` /
 *   `renderHookWithApollo`, so four suites calling `createApolloTestWrapper`
 *   directly were invisible to it — `useOperationUnits`, `usePantryAnalytics`,
 *   `useAdjustPantryItemQuantity`, `useCorrectPantryItemWeight`, none of which
 *   mentions either name;
 * - its file filter was `/\.test\.tsx?$/`, narrower than Jest's own
 *   `testMatch` (`**\/__tests__\/**\/*.[jt]s?(x)` plus `*.spec|test.[tj]s?(x)`),
 *   so a `.spec.ts`, a `.test.js`, or a suite living under a `__tests__/`
 *   directory ran for real while the check could not see it;
 * - `expect(offenders).toEqual([])` passes identically whether the contract
 *   holds or the scan matched nothing, so renaming the helper would have made
 *   it vacuous — `requireNonEmptyScan` exists in this repo for exactly that;
 * - and it never ran in the local loop at all: `lint-staged` runs
 *   `jest --findRelatedTests` over `src/**` only, and pre-push runs no jest.
 *
 * The two BEHAVIOURAL assertions stay where they were — they check what the
 * cache does, which no source scan can.
 *
 * ## What it checks
 *
 * 1. A test that reaches the shared helper must not build its own bare cache.
 *    Passing `new InMemoryCache()` into it reinstates the substitute for that
 *    suite alone while every other caller has moved off — the quietest possible
 *    regression, and one no assertion in the suite itself would notice.
 * 2. A test that mounts `MockedProvider` directly must pass a `cache`.
 *    `MockedProvider`'s constructor is `cache: cache || new Cache()`, so
 *    omitting it silently opts that suite out of every type policy. A second
 *    render helper did exactly this for three suites until it was deleted.
 * 3. A ratchet on files that seed WITHOUT naming a real fragment. A seed whose
 *    selection is derived from the fixture's own keys can never be incomplete,
 *    so it cannot be held to anything; the count may only shrink.
 *
 *   node scripts/check-test-cache-fidelity.mjs             # check
 *   node scripts/check-test-cache-fidelity.mjs --list      # print findings
 *   node scripts/check-test-cache-fidelity.mjs --update    # re-record the ratchet
 *   node scripts/check-test-cache-fidelity.mjs --self-test # prove it can fail
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

const CHECK = 'check-test-cache-fidelity';
const BASELINE = baselineFile(
  fromRoot('scripts/check-test-cache-fidelity.baseline.json'),
);

/**
 * Everything Jest would RUN, not everything that looks like a test.
 *
 * Mirrors `jest.config.js`: the default `testMatch` (any file under a
 * `__tests__/` directory, plus `*.test.*` / `*.spec.*` anywhere) minus
 * `testPathIgnorePatterns`. Narrower than that and a real suite is invisible;
 * wider and the check reports on helpers that never run.
 */
const IGNORED = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)e2e(\/|$)/,
  /^__tests__\/helpers\//,
  /^__tests__\/__mocks__\//,
  /^__tests__\/setup\//,
  /(^|\/)\.claude\/worktrees(\/|$)/,
];

function collectTestFiles() {
  const candidates = filesUnder(
    ['**/__tests__/**/*.{ts,tsx,js,jsx}', '**/*.{test,spec}.{ts,tsx,js,jsx}'],
    {
      exclude: [
        /(^|\/)node_modules(\/|$)/,
        /(^|\/)\.claude(\/|$)/,
        /(^|\/)e2e(\/|$)/,
      ],
    },
  );
  return candidates
    .map(file => relative(REPO_ROOT, file))
    .filter(file => !IGNORED.some(re => re.test(file)));
}

/** Reaches the shared helper, by whatever import spelling. */
const USES_HELPER =
  /['"][^'"]*test-utils\/apolloMockProvider['"]|['"][^'"]*helpers\/apolloMockProvider['"]/;
const BARE_CACHE = /new\s+InMemoryCache\s*\(/;
const MOUNTS_MOCKED_PROVIDER = /<MockedProvider\b/;
const PASSES_CACHE = /\bcache\s*=\s*\{|\bcache=\{|\bcache:\s*[A-Za-z_]/;
const SEEDS = /\bseedCache\s*\(/;
const NAMES_A_FRAGMENT = /\bfragment:\s*[A-Za-z_]/;

/**
 * The whole judgement, as a pure function of `[path, source]` pairs — so
 * `--self-test` can drive it with sources that are not on disk.
 */
export function classify(entries) {
  const bareCacheInHelperUser = [];
  const uncachedMockedProvider = [];
  const derivedSeeds = [];

  for (const [file, source] of entries) {
    const usesHelper = USES_HELPER.test(source);
    if (usesHelper && BARE_CACHE.test(source)) bareCacheInHelperUser.push(file);
    if (
      MOUNTS_MOCKED_PROVIDER.test(source) &&
      !PASSES_CACHE.test(source) &&
      !usesHelper
    ) {
      uncachedMockedProvider.push(file);
    }
    if (SEEDS.test(source) && !NAMES_A_FRAGMENT.test(source)) {
      derivedSeeds.push(file);
    }
  }

  return {
    bareCacheInHelperUser: bareCacheInHelperUser.sort(),
    uncachedMockedProvider: uncachedMockedProvider.sort(),
    derivedSeeds: derivedSeeds.sort(),
    helperUsers: entries.filter(([, source]) => USES_HELPER.test(source))
      .length,
  };
}

// ---------------------------------------------------------------------------
// Self-test: the check's own ability to fail, in each form it claims to catch.
// ---------------------------------------------------------------------------
function selfTest() {
  const cases = [
    [
      'a bare cache passed into renderWithApollo',
      [
        [
          'a.test.ts',
          `import { renderWithApollo } from '#/test-utils/apolloMockProvider';
           const cache = new InMemoryCache();`,
        ],
      ],
      r => r.bareCacheInHelperUser.length === 1,
    ],
    [
      'a bare cache passed into createApolloTestWrapper (no render* mention)',
      [
        [
          'b.test.ts',
          `import { createApolloTestWrapper } from '#/test-utils/apolloMockProvider';
           const wrapper = createApolloTestWrapper({ cache: new InMemoryCache() });`,
        ],
      ],
      r => r.bareCacheInHelperUser.length === 1,
    ],
    [
      'the same violation written in a .spec.ts',
      [
        [
          'c.spec.ts',
          `import { seedCache } from '../helpers/apolloMockProvider';
           const cache = new InMemoryCache();`,
        ],
      ],
      r => r.bareCacheInHelperUser.length === 1,
    ],
    [
      'a MockedProvider mounted with no cache prop',
      [['d.test.tsx', `render(<MockedProvider>{children}</MockedProvider>)`]],
      r => r.uncachedMockedProvider.length === 1,
    ],
    [
      'a MockedProvider that does pass a cache is not flagged',
      [
        [
          'e.test.tsx',
          `render(<MockedProvider cache={cache}>{children}</MockedProvider>)`,
        ],
      ],
      r => r.uncachedMockedProvider.length === 0,
    ],
    [
      'a seed naming a real fragment is not counted as derived',
      [
        [
          'f.test.ts',
          `import { seedCache } from '#/test-utils/apolloMockProvider';
           seedCache([{ fragment: ROW, data }]);`,
        ],
      ],
      r => r.derivedSeeds.length === 0,
    ],
  ];

  let failed = 0;
  for (const [name, entries, predicate] of cases) {
    const ok = predicate(classify(entries));
    console.log(`  ${ok ? '✓' : '✗'} ${name}`);
    if (!ok) failed += 1;
  }

  // The scan's own emptiness is a failure, not a pass — proven here rather
  // than asserted in prose.
  const empty = classify([]);
  const emptyIsRejected = empty.helperUsers === 0;
  console.log(
    `  ${
      emptyIsRejected ? '✓' : '✗'
    } an empty scan is distinguishable from a clean tree`,
  );
  if (!emptyIsRejected) failed += 1;

  if (failed > 0) {
    console.error(`\n✗ ${CHECK} --self-test: ${failed} case(s) failed.\n`);
    process.exit(2);
  }
  console.log(`\n✓ ${CHECK} --self-test: all cases pass.\n`);
}

// ---------------------------------------------------------------------------

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
  'self-test': { type: 'boolean', default: false },
});

if (flags['self-test']) {
  selfTest();
  process.exit(0);
}

const files = collectTestFiles();
const entries = files.map(file => [file, readFileSync(fromRoot(file), 'utf8')]);
const result = classify(entries);

requireNonEmptyScan({
  count: result.helperUsers,
  what: 'suites using the shared Apollo helper',
  check: CHECK,
  hint:
    'the helper was renamed or moved, so the import scan matches nothing — ' +
    'update USES_HELPER in this script',
  minimum: 100,
});

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: result.derivedSeeds.length,
    baselineCount: (BASELINE.read()?.derivedSeeds ?? []).length,
    check: CHECK,
  });
  BASELINE.write({ derivedSeeds: result.derivedSeeds });
  console.log(
    `✓ ${CHECK}: recorded ${result.derivedSeeds.length} derived-shape seed file(s).`,
  );
  process.exit(0);
}

let failures = 0;

if (result.bareCacheInHelperUser.length > 0) {
  failures += 1;
  console.error(
    `\n✗ ${CHECK}: ${result.bareCacheInHelperUser.length} suite(s) use the ` +
      `shared Apollo helper AND build a bare \`InMemoryCache\`.\n\n` +
      `  That reinstates the reduced cache for those suites alone: no type\n` +
      `  policies, no possibleTypes, no merge or read functions. A test that\n` +
      `  genuinely needs a reduced cache builds one WITHOUT the helper, where\n` +
      `  the choice is visible.\n\n` +
      result.bareCacheInHelperUser.map(f => `    - ${f}`).join('\n') +
      '\n',
  );
}

if (result.uncachedMockedProvider.length > 0) {
  failures += 1;
  console.error(
    `\n✗ ${CHECK}: ${result.uncachedMockedProvider.length} suite(s) mount ` +
      `\`MockedProvider\` with no \`cache\`.\n\n` +
      `  Its constructor is \`cache: cache || new Cache()\`, so this is the\n` +
      `  reduced cache by omission. Use \`renderWithApollo\` from\n` +
      `  \`#/test-utils/apolloMockProvider\` instead.\n\n` +
      result.uncachedMockedProvider.map(f => `    - ${f}`).join('\n') +
      '\n',
  );
}

const baseline = BASELINE.require(CHECK).derivedSeeds ?? [];
const { added } = diffSets(result.derivedSeeds, baseline);
if (added.length > 0) {
  failures += 1;
  console.error(
    `\n✗ ${CHECK}: ${added.length} new file(s) seed the cache without naming ` +
      `a fragment.\n\n` +
      `  A seed whose selection is derived from the fixture's own keys cannot\n` +
      `  be incomplete, so nothing holds it to the shape the app reads. Pass\n` +
      `  the production document: \`seedCache([{ fragment, data }])\`.\n` +
      `  This list may only shrink.\n\n` +
      added.map(f => `    - ${f}`).join('\n') +
      '\n',
  );
}

if (flags.list) {
  console.log(JSON.stringify(result, null, 2));
}

if (failures > 0) process.exit(1);

console.log(
  `✓ ${CHECK}: ${result.helperUsers} helper users, no bare caches; ` +
    `${result.derivedSeeds.length} derived-shape seed file(s) (baseline ${baseline.length}).`,
);
