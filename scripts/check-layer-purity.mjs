#!/usr/bin/env node
/**
 * Fails when the shared UI kit (`src/components/`, `src/hooks/`) knows about a
 * feature.
 *
 * ## The rule
 *
 * `src/components/atoms/README.md` already states it: *"A component that
 * belongs to exactly one feature does not go in any of these; it goes in that
 * feature's own `components/` folder."* Nothing enforced it, so 89 of 293
 * non-test files under `src/components/` ended up naming a domain, `modals/`
 * became 36/45 feature code, and two atoms import a leaf feature's private
 * theme context.
 *
 * The kit is what a sibling app reuses. Every edge recorded here is a file that
 * has to be ported, forked or deleted before it can be.
 *
 * ## What counts
 *
 * Four kinds, each an unambiguous structural fact rather than a guess:
 *
 *   featureImport  imports `#features/…` (or a relative path into it)
 *   ownsGraphql    a `.graphql` document colocated in the kit
 *   featureName    the file or a parent directory is named after a feature
 *   schemaTypes    imports generated schema types (enums, inputs, scalars)
 *
 * `schemaTypes` is tracked separately and NOT part of the fail condition. With
 * the backend question open it is a cost to know about, not yet a defect: a kit
 * component taking `DisplayFormat` instead of a local union only matters when a
 * sibling app has a different schema. Read it, shrink it where cheap.
 *
 * Content is deliberately not searched. Grepping the kit for the word "pantry"
 * finds 251 files, most of them a comment or a test fixture; a gate that noisy
 * gets disabled. A file NAMED `MoveToPantryModal.tsx` is not a judgement call.
 *
 *   node scripts/check-layer-purity.mjs           # check
 *   node scripts/check-layer-purity.mjs --list    # print every finding
 *   node scripts/check-layer-purity.mjs --update  # re-baseline
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
  fromRoot('scripts/check-layer-purity.baseline.json'),
);

/**
 * The kit: what a sibling app is meant to take wholesale.
 *
 * `src/app/` is deliberately absent. That is the composition root — the
 * provider that mounts every feature's subscriptions, the one that preloads
 * every feature's data. Those exist to know the feature list, so measuring
 * them against a rule that forbids knowing it would be measuring the wrong
 * thing. See `src/app/README.md`.
 */
const KIT_GLOBS = ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'];
const KIT_GRAPHQL = ['src/components/**/*.graphql', 'src/hooks/**/*.graphql'];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
];

/**
 * Feature ids, read from the directory listing rather than `registry.ts`.
 *
 * The registry is TypeScript and this script runs on bare node in CI jobs that
 * skip `npm ci`. `check-feature-shape.mjs` is what keeps a manifest's `id`
 * equal to its directory name, so the two agree by construction.
 */
const FEATURE_IDS = filesUnder('src/features/*/manifest.ts')
  .map(f => f.split(sep).at(-2))
  .sort();

/**
 * Domain words that are not feature directory names.
 *
 * `storageLocation`, `ingredient` and `purchase` are pantry/shopping/recipe
 * entities that got their own kit files; the rest are the verbs the kit
 * branches on today.
 */
const EXTRA_DOMAIN_TERMS = [
  'storageLocation',
  'ingredient',
  'purchase',
  'restock',
  'consume',
  'waste',
  'cuisine',
  'dietary',
  'nutrition',
  'grocery',
];

/**
 * Feature ids that are app chrome, not a domain.
 *
 * `home` collides with the tab-navigator sense of the word (`HomeTabs`),
 * `profile` and `notifications` name concepts every app of this shape has.
 * Excluding them keeps the name test precise; their real coupling still shows
 * up as `featureImport`.
 */
const AMBIGUOUS_IDS = new Set(['home', 'profile', 'notifications']);

/**
 * Both forms of each term. The feature directory is `recipes`, but the files
 * that belong to it are named `RecipeSkeleton`, `SaveRecipeSheet`,
 * `ManageRecipeSheet` — singular every time.
 */
const withSingular = term =>
  term.endsWith('s') ? [term, term.slice(0, -1)] : [term];

const DOMAIN_TERMS = [
  ...new Set(
    [
      ...FEATURE_IDS.filter(id => !AMBIGUOUS_IDS.has(id)),
      ...EXTRA_DOMAIN_TERMS,
    ].flatMap(withSingular),
  ),
];

const IMPORT_SOURCE =
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
const REACHES_FEATURE = /^#features\//;
const RELATIVE_FEATURE = /(^|\/)features\//;
const SCHEMA_TYPES =
  /^(#generated|#\/graphql\/generated)|graphql\/generated\/schemaTypes/;

/**
 * Split camelCase/PascalCase into lowercase words before matching.
 *
 * A naive `[^a-z]` boundary misses the common case: in `MoveToPantryModal` the
 * character before `Pantry` is a lowercase `o`, so the term never matched and
 * the file read as clean.
 */
const words = name => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();

const DOMAIN_WORD_RES = DOMAIN_TERMS.map(term => ({
  term,
  re: new RegExp(`\\b${words(term).replace(/\\s+/g, '\\s')}\\b`),
}));

/** The file, or a directory above it inside the kit, is named after a feature. */
const namesDomain = relPath => {
  const segments = relPath
    .split('/')
    .slice(2) // drop `src/<kit-dir>`
    .map(words);
  return DOMAIN_WORD_RES.find(({ re }) => segments.some(s => re.test(s)))?.term;
};

const importsOf = source => {
  const found = [];
  for (const [, spec] of source.matchAll(IMPORT_SOURCE)) found.push(spec);
  return found;
};

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const kitFiles = filesUnder(KIT_GLOBS, { exclude: SKIP });

requireNonEmptyScan({
  count: kitFiles.length,
  what: 'kit files',
  check: 'check-layer-purity',
  hint: 'src/components/ or src/hooks/ moved, or the glob no longer matches',
  minimum: 100,
});

const findings = new Map(); // relPath -> Set of kinds
const record = (relPath, kind) => {
  if (!findings.has(relPath)) findings.set(relPath, new Set());
  findings.get(relPath).add(kind);
};

const schemaTypeFiles = new Set();

for (const file of kitFiles) {
  const rel = relative(REPO_ROOT, file);
  const source = readFileSync(file, 'utf8');
  const specs = importsOf(source);

  if (specs.some(s => REACHES_FEATURE.test(s) || RELATIVE_FEATURE.test(s))) {
    record(rel, 'featureImport');
  }
  if (namesDomain(rel)) record(rel, 'featureName');
  if (specs.some(s => SCHEMA_TYPES.test(s))) schemaTypeFiles.add(rel);
}

for (const file of filesUnder(KIT_GRAPHQL, { exclude: SKIP })) {
  record(relative(REPO_ROOT, file), 'ownsGraphql');
}

const current = [...findings.keys()].sort();
const recorded = BASELINE.exists() ? BASELINE.read().files ?? [] : [];

if (flags.list) {
  for (const rel of current) {
    console.log(`${[...findings.get(rel)].sort().join(',').padEnd(34)} ${rel}`);
  }
  console.log(
    `\n${current.length} kit file(s) coupled to a feature.` +
      `\n${schemaTypeFiles.size} kit file(s) import generated schema types (tracked, not failing).`,
  );
  process.exit(0);
}

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-layer-purity',
  });
  BASELINE.write({
    files: current,
    schemaTypeImporters: [...schemaTypeFiles].sort(),
    scannedFiles: kitFiles.length,
  });
  console.log(
    `Recorded ${current.length} coupled kit file(s) from ${kitFiles.length} scanned.`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-layer-purity');
const { added, removed } = diffSets(current, baseline.files ?? []);

if (added.length) {
  console.error(
    `\n✗ check-layer-purity: ${added.length} kit file(s) newly coupled to a feature.\n`,
  );
  for (const rel of added) {
    console.error(
      `    ${[...findings.get(rel)].sort().join(',').padEnd(30)} ${rel}`,
    );
  }
  console.error(
    `\n  The kit is what a sibling app reuses wholesale. A file here that\n` +
      `  imports a feature, owns a .graphql document, or is named after a\n` +
      `  domain belongs in that feature's own components/ or hooks/ folder —\n` +
      `  see src/components/atoms/README.md.\n\n` +
      `  If the coupling is genuinely unavoidable, say why in the file and\n` +
      `  re-baseline deliberately with --update.\n`,
  );
  process.exit(1);
}

console.log(
  `check-layer-purity: ${current.length} coupled kit file(s), ` +
    `baseline ${baseline.files.length}` +
    (removed.length ? ` (${removed.length} cleared — run --update)` : '') +
    `.\n${schemaTypeFiles.size} import generated schema types (tracked).`,
);
