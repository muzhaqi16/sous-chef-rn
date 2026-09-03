#!/usr/bin/env node
/**
 * Fails when a module in a SHARED layer is used by exactly one feature.
 *
 * ## The rule
 *
 * `src/components/atoms/README.md` and `CLAUDE.md` both say it: the kit and the
 * shared hooks hold ONLY what more than one feature uses. Nothing could enforce
 * it, because the existing gates test names and imports — neither of which can
 * see that `Avatar` has one consumer, or that `ShoppingEmptyIllustration` is
 * shoppingList's.
 *
 * 55 of 183 kit components and 23 of 85 kit hooks have exactly one consuming
 * feature. Each is a file a sibling app inherits without wanting, and a file
 * whose owner cannot find it.
 *
 * ## How a consumer is counted
 *
 * Imports are resolved through `tsconfig.json`'s aliases (the same single
 * source Babel and Jest derive from), then attributed to a feature by path:
 *
 *   src/features/<id>/**        -> that feature
 *   src/screens/auth/**         -> `auth`         (a feature without a manifest)
 *   src/screens/onBoarding/**   -> `onboarding`   (likewise)
 *   anything else               -> no feature
 *
 * Reach is TRANSITIVE through other shared modules: a hook used only by an
 * atom that only pantry renders belongs to pantry too. A module with zero
 * feature consumers is kit-internal or app-chrome and is never reported —
 * absence of a consumer is a different problem, and `check-dead-modules`
 * already owns it.
 *
 * ## The baseline
 *
 * A DEBT LIST that may only shrink, like the kernel half of
 * `check-layer-purity`. Every entry removed is a module that moved into the
 * feature that owns it. When it empties, the rule becomes an invariant and this
 * gate replaces the kernel NAME test, which only ever approximated it.
 *
 *   node scripts/check-single-consumer.mjs           # check
 *   node scripts/check-single-consumer.mjs --list    # print every finding
 *   node scripts/check-single-consumer.mjs --update  # re-baseline
 *   node scripts/check-single-consumer.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

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

const ALIAS_PAIRS = createRequire(import.meta.url)(
  './lib/aliases.js',
).prefixPairs();

const BASELINE = baselineFile(
  fromRoot('scripts/check-single-consumer.baseline.json'),
);

/** The layers whose contents are meant to serve more than one feature. */
const SHARED_GLOBS = [
  'src/components/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
  'src/context/**/*.{ts,tsx}',
  'src/utils/**/*.{ts,tsx}',
  'src/constants/**/*.{ts,tsx}',
];

/** Everything that can consume a shared module. */
const ALL_GLOBS = ['src/**/*.{ts,tsx}'];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /\.test\.tsx?$/,
  /\.d\.ts$/,
];

/**
 * `src/app` is the composition root: it knows every feature by design, so it is
 * never a consumer for this purpose — counting it would make every module it
 * touches look shared. Same reasoning `check-layer-purity` applies.
 */
const NOT_A_CONSUMER = [/^src\/app\//];

const IMPORT_SOURCE =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

/**
 * The feature a file belongs to, or null. Auth and onboarding live outside
 * `src/features` today and are counted as the features they are — otherwise
 * every module that exists only for them reads as having no owner.
 */
export function featureOf(relPath) {
  const feature = relPath.match(/^src\/features\/([^/]+)\//);
  if (feature) return feature[1];
  if (relPath.startsWith('src/screens/auth/')) return 'auth';
  if (relPath.startsWith('src/screens/onBoarding/')) return 'onboarding';
  return null;
}

const importsOf = source => {
  const found = [];
  for (const [, spec] of source.matchAll(IMPORT_SOURCE)) found.push(spec);
  return found;
};

const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

if (process.argv.includes('--self-test')) {
  const cases = [
    ['src/features/pantry/screens/PantryMain.tsx', 'pantry'],
    ['src/features/shoppingList/hooks/useX.ts', 'shoppingList'],
    ['src/screens/auth/LoginScreen.tsx', 'auth'],
    ['src/screens/onBoarding/CreateHomeScreen.tsx', 'onboarding'],
    ['src/components/atoms/Text.tsx', null],
    ['src/app/providers/DataProvider.tsx', null],
    ['src/utils/dateUtils.ts', null],
  ];
  let failed = false;
  for (const [path, expected] of cases) {
    const got = featureOf(path);
    if (got !== expected) {
      console.error(
        `✗ Self-test failed: ${path} attributed to ${got}, expected ${expected}.`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(2);
  console.log(
    '✓ Self-test passed: files are attributed to their feature, and auth\n' +
      '  and onboarding count as features while they live outside src/features.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const allFiles = filesUnder(ALL_GLOBS, { exclude: SKIP });

requireNonEmptyScan({
  count: allFiles.length,
  what: 'source files',
  check: 'check-single-consumer',
  hint: 'src/ moved, or the glob no longer matches',
  minimum: 200,
});

const allRel = new Set(allFiles.map(f => relative(REPO_ROOT, f)));
const sharedRel = new Set(
  filesUnder(SHARED_GLOBS, { exclude: SKIP }).map(f => relative(REPO_ROOT, f)),
);

const resolveImport = (spec, fromRel) => {
  let base = null;
  if (spec.startsWith('.')) {
    base = relative(
      REPO_ROOT,
      resolve(dirname(join(REPO_ROOT, fromRel)), spec),
    );
  } else {
    for (const [alias, target] of ALIAS_PAIRS) {
      if (spec.startsWith(alias)) {
        base = target + spec.slice(alias.length);
        break;
      }
    }
  }
  if (!base) return null;
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (allRel.has(candidate)) return candidate;
  }
  return null;
};

/** importer -> the in-repo files it imports. */
const graph = new Map();
for (const file of allFiles) {
  const rel = relative(REPO_ROOT, file);
  graph.set(
    rel,
    importsOf(readFileSync(file, 'utf8'))
      .map(spec => resolveImport(spec, rel))
      .filter(target => target !== null && target !== rel),
  );
}

/** target -> the files that import it. */
const importers = new Map();
for (const [rel, targets] of graph) {
  for (const target of targets) {
    if (!importers.has(target)) importers.set(target, new Set());
    importers.get(target).add(rel);
  }
}

/**
 * Which features reach `rel`, walking back through shared modules. A feature
 * file is a leaf: its own consumers do not matter, it IS the consumer.
 */
const reachingFeatures = new Map();
const featuresReaching = rel => {
  if (reachingFeatures.has(rel)) return reachingFeatures.get(rel);
  const found = new Set();
  reachingFeatures.set(rel, found); // cycle guard: a partial answer beats a hang
  for (const importer of importers.get(rel) ?? []) {
    if (NOT_A_CONSUMER.some(re => re.test(importer))) continue;
    const feature = featureOf(importer);
    if (feature) {
      found.add(feature);
      continue;
    }
    if (sharedRel.has(importer)) {
      for (const f of featuresReaching(importer)) found.add(f);
    }
  }
  return found;
};

const findings = new Map(); // relPath -> the one feature that uses it
for (const rel of sharedRel) {
  const features = featuresReaching(rel);
  if (features.size === 1) findings.set(rel, [...features][0]);
}

const current = [...findings.keys()].sort();

if (flags.list) {
  const byFeature = new Map();
  for (const [rel, feature] of findings) {
    if (!byFeature.has(feature)) byFeature.set(feature, []);
    byFeature.get(feature).push(rel);
  }
  for (const [feature, files] of [...byFeature].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`\n${feature} (${files.length})`);
    for (const rel of files.sort()) console.log(`    ${rel}`);
  }
  console.log(
    `\n${current.length} shared module(s) used by exactly one feature.`,
  );
  process.exit(0);
}

const recorded = BASELINE.exists() ? BASELINE.read().files ?? [] : [];

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-single-consumer',
  });
  BASELINE.write({
    files: current,
    owners: Object.fromEntries(
      [...findings.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    scannedFiles: sharedRel.size,
  });
  console.log(
    `Recorded ${current.length} single-consumer module(s) from ${sharedRel.size} shared files.`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-single-consumer');
const { added, removed } = diffSets(current, baseline.files ?? []);

if (added.length) {
  console.error(
    `\n✗ check-single-consumer: ${added.length} shared module(s) are used by exactly one feature.\n`,
  );
  for (const rel of added) {
    console.error(`    ${findings.get(rel).padEnd(16)} ${rel}`);
  }
  console.error(
    `\n  A module in src/components, src/hooks, src/context, src/utils or\n` +
      `  src/constants is there because more than one feature uses it. Move\n` +
      `  this one into the feature named beside it — see\n` +
      `  src/components/atoms/README.md.\n\n` +
      `  If a second feature is about to adopt it, land that first.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-single-consumer: ${removed.length} baselined module(s) are shared now.\n`,
  );
  for (const rel of removed) console.error(`    ${rel}`);
  console.error(
    `\n  Record it: node scripts/check-single-consumer.mjs --update\n`,
  );
  process.exit(1);
}

console.log(
  `check-single-consumer: ${current.length} shared module(s) used by exactly ` +
    `one feature, baseline ${baseline.files?.length ?? 0}.`,
);
