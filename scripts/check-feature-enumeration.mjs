#!/usr/bin/env node
/**
 * Fails when a module outside the features directory hard-codes a feature id.
 *
 * ## The rule
 *
 * `FEATURE_REGISTRY` is meant to be the one place that knows the feature list.
 * It is not: removing a feature today means editing ~17 other sites — the
 * locale bundler, the subscriptions provider, the offline preloader, the sync
 * dispatcher, push routing, the cache's type policies, the reset manager's
 * session keys. Each was written by hand and each is invisible until the day it
 * is wrong.
 *
 * A feature id appearing as a STRING outside its own feature is that coupling
 * made visible. The fix is always the same shape: put the thing the string
 * selects on the feature's manifest, and iterate the registry instead.
 *
 * ## What counts
 *
 * A string literal exactly equal to a feature directory name, in a module
 * outside `src/features/` and outside the registry itself.
 *
 * Exact equality, not a substring: `'pantry'` is a finding, `'pantryItemId'`
 * is not. Comments, imports and index accesses are stripped first, so
 * `#features/pantry/...`, prose about the pantry, and `GetPantryQuery['pantry']`
 * do not count — the import graph is another gate's business, a field name is
 * the schema's, and this one is about a runtime SELECTOR.
 *
 * `home`, `profile`, `notifications`, `auth` and `onboarding` are excluded for
 * the reason `check-layer-purity` excludes them: each names a concept every app
 * has — an OS permission, a settings section, a tab, a session state, a setup
 * mode — so an exact match on one says nothing about feature coupling.
 *
 * ## The allowlist
 *
 * Two places legitimately name features: the tab layout, which is an ordered
 * list of screens rather than a lookup, and typed deep-link routes, where the
 * literal is part of a route type the navigator must state. Both are in
 * `ALLOWED`.
 *
 * The baseline is a DEBT LIST that may only shrink.
 *
 *   node scripts/check-feature-enumeration.mjs           # check
 *   node scripts/check-feature-enumeration.mjs --list    # print every finding
 *   node scripts/check-feature-enumeration.mjs --update  # re-baseline
 *   node scripts/check-feature-enumeration.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';

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
  fromRoot('scripts/check-feature-enumeration.baseline.json'),
);

const SCAN_GLOBS = ['src/**/*.{ts,tsx}'];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
  /\.d\.ts$/,
  /^src\/features\//,
];

/**
 * Files whose feature names are structural rather than a lookup.
 * `HomeTabs` is an ordered list of screens; the navigator's route types state
 * their own names by definition.
 */
const ALLOWED = [/^src\/navigation\/stacks\//, /^src\/navigation\/types\.ts$/];

/**
 * Ids that name a generic concept as well as a feature. Same set, same reason,
 * as `check-layer-purity`: `notifications` is an OS permission, `profile` and
 * `home` are screens every app has.
 */
const AMBIGUOUS_IDS = new Set([
  'home',
  'profile',
  'notifications',
  'auth',
  'onboarding',
]);

/** Feature ids, from the directory listing — the same source every gate uses. */
const FEATURE_IDS = filesUnder('src/features/*/manifest.ts')
  .map(f => f.split(sep).at(-2))
  .filter(id => !AMBIGUOUS_IDS.has(id))
  .sort();

/**
 * Strip what is not a runtime selector: comments, and import/require
 * specifiers. A path mentioning a feature is the import graph's business.
 */
export function stripNonSelectors(source) {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
      .replace(/(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"][^'"]+['"]/g, ' ')
      .replace(/^\s*import\s+[^;]*;/gm, ' ')
      // `GetPantryQuery['pantry']` reads a field; the name is the schema's.
      .replace(/[\w\]]\s*\[\s*['"][^'"\n]*['"]\s*\]/g, ' ')
  );
}

/** Feature ids appearing as an exact string literal. */
export function enumeratedFeatures(source, featureIds) {
  const body = stripNonSelectors(source);
  const found = new Set();
  for (const [, value] of body.matchAll(/['"]([^'"\n]*)['"]/g)) {
    if (featureIds.includes(value)) found.add(value);
  }
  return [...found].sort();
}

if (process.argv.includes('--self-test')) {
  const ids = ['pantry', 'recipes', 'shoppingList'];
  const cases = [
    ["const f = 'pantry';", ['pantry']],
    ['const f = "recipes";', ['recipes']],
    // Not a selector: a substring, an import, a comment.
    ["const id = 'pantryItemId';", []],
    ["import { x } from '#features/pantry/hooks/useX';", []],
    ["// the pantry feature owns this\nconst s = 'other';", []],
    ["/* pantry */ const s = 'other';", []],
    ["type X = GetPantryQuery['pantry'];", []],
    ["const v = obj['pantry'];", []],
    ["const a = 'pantry'; const b = 'recipes';", ['pantry', 'recipes']],
  ];
  let failed = false;
  for (const [source, expected] of cases) {
    const got = enumeratedFeatures(source, ids);
    if (got.join(',') !== expected.join(',')) {
      console.error(
        `✗ Self-test failed for ${JSON.stringify(
          source,
        )}: expected [${expected}], got [${got}].`,
      );
      failed = true;
    }
  }
  if (FEATURE_IDS.length < 4) {
    console.error(
      `✗ Self-test failed: only ${FEATURE_IDS.length} feature id(s) found; the listing is wrong.`,
    );
    failed = true;
  }
  if (failed) process.exit(2);
  console.log(
    `✓ Self-test passed: an exact feature-id literal is a finding, and a\n` +
      `  substring, an import path and a comment are not (${FEATURE_IDS.length} features).`,
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
  what: 'non-feature source files',
  check: 'check-feature-enumeration',
  hint: 'src/ moved, or the glob no longer matches',
  minimum: 100,
});

const findings = new Map(); // relPath -> feature ids named
for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  if (ALLOWED.some(re => re.test(rel))) continue;
  const named = enumeratedFeatures(readFileSync(file, 'utf8'), FEATURE_IDS);
  if (named.length > 0) findings.set(rel, named);
}

const current = [...findings.keys()].sort();

if (flags.list) {
  for (const rel of current) {
    console.log(`${findings.get(rel).join(',').padEnd(40)} ${rel}`);
  }
  console.log(
    `\n${current.length} module(s) outside src/features name a feature.` +
      `\n${files.length} file(s) scanned across ${FEATURE_IDS.length} features.`,
  );
  process.exit(0);
}

const recorded = BASELINE.exists() ? BASELINE.read().files ?? [] : [];

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-feature-enumeration',
  });
  BASELINE.write({
    files: current,
    named: Object.fromEntries(
      [...findings.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    scannedFiles: files.length,
  });
  console.log(
    `Recorded ${current.length} module(s) naming a feature from ${files.length} scanned.`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-feature-enumeration');
const { added, removed } = diffSets(current, baseline.files ?? []);

if (added.length) {
  console.error(
    `\n✗ check-feature-enumeration: ${added.length} module(s) newly name a feature.\n`,
  );
  for (const rel of added) {
    console.error(`    ${findings.get(rel).join(',').padEnd(36)} ${rel}`);
  }
  console.error(
    `\n  Removing a feature should mean deleting its folder and one registry\n` +
      `  line. Every literal here is another edit that has to be remembered.\n\n` +
      `  Put what the string selects on the feature's manifest and iterate\n` +
      `  FEATURE_REGISTRY instead.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-feature-enumeration: ${removed.length} baselined module(s) stopped naming a feature.\n`,
  );
  for (const rel of removed) console.error(`    ${rel}`);
  console.error(
    `\n  Record it: node scripts/check-feature-enumeration.mjs --update\n`,
  );
  process.exit(1);
}

console.log(
  `check-feature-enumeration: ${current.length} module(s) outside src/features ` +
    `name a feature, baseline ${baseline.files?.length ?? 0}.`,
);
