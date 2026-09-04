#!/usr/bin/env node
/**
 * Fails when a presentation module holds the data client or its cache.
 *
 * ## The rule
 *
 * A screen, sheet or list cell gets its data from a hook in its feature's
 * `hooks/` directory. It does not import `@apollo/client`, obtain a client
 * instance, or read and write the normalized cache itself.
 *
 * That coupling is what makes every data-layer change a screen change: touching
 * a cache updater means touching the sheets that call it and the tests that
 * render them. It is also the seam any future client swap needs, whichever
 * client that turns out to be.
 *
 * ## What counts
 *
 * Four structural facts, each unambiguous rather than a judgement:
 *
 *   clientImport   imports a DATA-ACCESS name from `@apollo/client` — running
 *                  an operation, holding the client, writing the cache
 *   apolloUtils    imports `src/apollo/**` — the links, cache and updaters
 *   operationTypes imports a generated operation document or result type
 *   ownsGraphql    a `.graphql` document colocated under a UI directory
 *
 * The first two FAIL. The last two are TRACKED and
 * reported but do not fail, the same split `check-layer-purity` uses for
 * `schemaTypes`: with `dataMasking` on, a generated fragment type IS the app's
 * domain model, so a list cell typed by one is the documented pattern rather
 * than a defect. Knowing the number is what matters until that changes.
 *
 * Content is not searched. `useQuery(` in a screen is a call the file makes,
 * but an import is a fact about the module graph, and the import is what has to
 * move.
 *
 * The failing baseline is EMPTY, which makes it an INVARIANT rather than a debt
 * list: any finding is a regression to fix, never a number to re-record.
 *
 * `apolloUtils` also has a hard `import/no-restricted-paths` zone in
 * `.eslintrc.js`, so the editor catches that half. `clientImport` stays here
 * because it is name-aware — `useFragment` and the masking types are the
 * documented pattern and must not be banned — and expressing that as a
 * `no-restricted-imports` override covering these globs would REPLACE the rule
 * for the eight kit files that already carry a narrower one.
 *
 *   node scripts/check-data-layer-boundary.mjs           # check
 *   node scripts/check-data-layer-boundary.mjs --list    # print every finding
 *   node scripts/check-data-layer-boundary.mjs --update  # re-baseline
 *   node scripts/check-data-layer-boundary.mjs --self-test
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
  fromRoot('scripts/check-data-layer-boundary.baseline.json'),
);

/**
 * The presentation layer: what renders. `src/components` is already clean and
 * is scanned so it stays that way.
 */
const UI_GLOBS = [
  'src/features/*/screens/**/*.{ts,tsx}',
  'src/features/*/components/**/*.{ts,tsx}',
  'src/features/*/ui/**/*.{ts,tsx}',
  'src/screens/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
];

const UI_GRAPHQL = [
  'src/features/*/screens/**/*.graphql',
  'src/features/*/components/**/*.graphql',
  'src/features/*/ui/**/*.graphql',
  'src/screens/**/*.graphql',
  'src/components/**/*.graphql',
];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
];

const IMPORT_SOURCE =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

/** `@apollo/client`, `@apollo/client/react`, `@apollo/client/masking`, … */
const CLIENT_MODULE = /^@apollo\/client(\/|$)/;

/**
 * The names that mean a module is DOING data access: running an operation,
 * holding the client, or writing the cache. `useFragment` and the masking types
 * are absent on purpose — with `dataMasking` on, a cell subscribing to one
 * entity is the documented pattern the spec permits.
 */
const DATA_ACCESS_NAMES =
  /\b(useQuery|useMutation|useLazyQuery|useSubscription|useApolloClient|useSuspenseQuery|useBackgroundQuery|ApolloClient|ApolloCache|InMemoryCache)\b/;

/** The names a module imports from `@apollo/client*`, across all its imports. */
const clientImportNames = source => {
  const names = [];
  const re = /import\s+([^;]*?)\s*from\s*['"](@apollo\/client[^'"]*)['"]/g;
  for (const [, clause] of source.matchAll(re)) names.push(clause);
  return names.join(' ');
};

/**
 * The app's own data layer: links, cache, updaters, offline queue.
 * `alertRejectedMutation` is excluded — it sits here by location, but its job is
 * turning a refusal's `field` and `code` into localized copy, which is
 * presentation.
 */
const APOLLO_UTILS = /^#\/?apollo(?!\/utils\/alertRejectedMutation)(\/|$)/;

/**
 * A generated operation document or its result types. `#generated` alone is the
 * schema-type barrel (enums, inputs) — narrower coupling, and already tracked by
 * `check-layer-purity`, so it is deliberately not matched here.
 */
const OPERATION_TYPES = /(^#operations(\/|$))|\.generated$|\.generated'/;

export function classify(specs, source = '') {
  const kinds = new Set();
  for (const spec of specs) {
    if (APOLLO_UTILS.test(spec)) kinds.add('apolloUtils');
    if (OPERATION_TYPES.test(spec) || /\.generated$/.test(spec)) {
      kinds.add('operationTypes');
    }
  }
  if (
    specs.some(spec => CLIENT_MODULE.test(spec)) &&
    DATA_ACCESS_NAMES.test(clientImportNames(source))
  ) {
    kinds.add('clientImport');
  }
  return kinds;
}

const importsOf = source => {
  const found = [];
  for (const [, spec] of source.matchAll(IMPORT_SOURCE)) found.push(spec);
  return found;
};

/** Kinds that fail the build. The rest are reported and watched. */
const FAILING_KINDS = new Set(['clientImport', 'apolloUtils']);

if (process.argv.includes('--self-test')) {
  const cases = [
    [
      ['@apollo/client'],
      ['clientImport'],
      "import { ApolloClient } from '@apollo/client';",
    ],
    [
      ['@apollo/client/react'],
      ['clientImport'],
      "import { useQuery } from '@apollo/client/react';",
    ],
    // The documented masking pattern, not data access.
    [
      ['@apollo/client/react'],
      [],
      "import { useFragment } from '@apollo/client/react';",
    ],
    [
      ['@apollo/client/masking'],
      [],
      "import type { FragmentType } from '@apollo/client/masking';",
    ],
    [['#/apollo/utils/pantryCacheUpdaters'], ['apolloUtils']],
    // Refusal COPY, not the data layer — see the APOLLO_UTILS docblock.
    [['#/apollo/utils/alertRejectedMutation'], []],
    [['#apollo/links/queueLink'], ['apolloUtils']],
    [['#operations/item/item.generated'], ['operationTypes']],
    [['../graphql/pantry.generated'], ['operationTypes']],
    [['#components/atoms/Text'], []],
    [['react-native'], []],
    // The schema-type barrel is another gate's business.
    [['#generated/schemaTypes'], []],
  ];
  let failed = false;
  for (const [specs, expected, source] of cases) {
    const got = [...classify(specs, source ?? '')].sort();
    if (got.join(',') !== [...expected].sort().join(',')) {
      console.error(
        `✗ Self-test failed for ${specs[0]}: expected [${expected}], got [${got}].`,
      );
      failed = true;
    }
  }
  if (
    !FAILING_KINDS.has('clientImport') ||
    FAILING_KINDS.has('operationTypes')
  ) {
    console.error(
      '✗ Self-test failed: the failing/tracked split is not what the docblock states.',
    );
    failed = true;
  }
  if (failed) process.exit(2);
  console.log(
    '✓ Self-test passed: client and apollo-internal imports are classified\n' +
      '  and fail; generated operation types are tracked, not failed.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const uiFiles = filesUnder(UI_GLOBS, { exclude: SKIP });

requireNonEmptyScan({
  count: uiFiles.length,
  what: 'UI files',
  check: 'check-data-layer-boundary',
  hint: 'a screens/, components/ or ui/ directory moved, or the glob no longer matches',
  minimum: 100,
});

const findings = new Map(); // relPath -> Set of kinds
const record = (relPath, kind) => {
  if (!findings.has(relPath)) findings.set(relPath, new Set());
  findings.get(relPath).add(kind);
};

for (const file of uiFiles) {
  const rel = relative(REPO_ROOT, file);
  const source = readFileSync(file, 'utf8');
  for (const kind of classify(importsOf(source), source)) {
    record(rel, kind);
  }
}

for (const file of filesUnder(UI_GRAPHQL, { exclude: SKIP })) {
  record(relative(REPO_ROOT, file), 'ownsGraphql');
}

const failingOf = kinds => [...kinds].filter(k => FAILING_KINDS.has(k));

const current = [...findings.keys()]
  .filter(rel => failingOf(findings.get(rel)).length > 0)
  .sort();
const tracked = [...findings.keys()]
  .filter(rel => failingOf(findings.get(rel)).length === 0)
  .sort();

if (flags.list) {
  for (const rel of [...findings.keys()].sort()) {
    console.log(`${[...findings.get(rel)].sort().join(',').padEnd(38)} ${rel}`);
  }
  const count = kind =>
    [...findings.values()].filter(kinds => kinds.has(kind)).length;
  console.log(
    `\n${current.length} UI file(s) hold the data layer (failing).` +
      `\n  clientImport: ${count('clientImport')}` +
      `\n  apolloUtils:  ${count('apolloUtils')}` +
      `\n${count(
        'operationTypes',
      )} import generated operation types (tracked).` +
      `\n${count(
        'ownsGraphql',
      )} own a .graphql document under a UI directory (tracked).`,
  );
  process.exit(0);
}

const recorded = BASELINE.exists() ? BASELINE.read().files ?? [] : [];

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-data-layer-boundary',
  });
  BASELINE.write({
    files: current,
    trackedFiles: tracked,
    kinds: Object.fromEntries(
      [...findings.entries()]
        .map(([rel, kinds]) => [rel, [...kinds].sort()])
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    scannedFiles: uiFiles.length,
  });
  console.log(
    `Recorded ${current.length} UI file(s) holding the data layer from ` +
      `${uiFiles.length} scanned, and ${tracked.length} tracked-only file(s).`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-data-layer-boundary');
const { added, removed } = diffSets(current, baseline.files ?? []);

if (added.length) {
  console.error(
    `\n✗ check-data-layer-boundary: ${added.length} UI file(s) newly hold the data layer.\n`,
  );
  for (const rel of added) {
    console.error(
      `    ${failingOf(findings.get(rel)).sort().join(',').padEnd(30)} ${rel}`,
    );
  }
  console.error(
    `\n  A screen, sheet or cell reads data through a hook in its feature's\n` +
      `  hooks/ directory, which returns plain values and callbacks. Move the\n` +
      `  useQuery / useMutation / useApolloClient call there.\n\n` +
      `  This is the seam that keeps a data-layer change from touching screens\n` +
      `  and the tests that render them.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-data-layer-boundary: ${removed.length} baselined file(s) no longer hold the data layer.\n`,
  );
  for (const rel of removed) console.error(`    ${rel}`);
  console.error(
    `\n  Good — record it: node scripts/check-data-layer-boundary.mjs --update\n` +
      `  A baseline that outlives its entries stops meaning anything.\n`,
  );
  process.exit(1);
}

const trackedCount = kind =>
  [...findings.values()].filter(kinds => kinds.has(kind)).length;

console.log(
  `check-data-layer-boundary: ${current.length} UI file(s) hold the data ` +
    `layer — the invariant is 0.\n` +
    `${trackedCount('operationTypes')} import generated operation types, ` +
    `${trackedCount('ownsGraphql')} own a .graphql document (both tracked).`,
);
