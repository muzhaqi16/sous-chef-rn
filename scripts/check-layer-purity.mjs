#!/usr/bin/env node
/**
 * Fails when a layer below the features knows about one.
 *
 * Two scans with two different baseline meanings:
 *
 *   KIT     `src/components/`, `src/hooks/` — baseline EMPTY, an invariant.
 *           Four kinds of coupling; see "What counts" below.
 *   KERNEL  `src/apollo/`, `src/store/`, `src/utils/`, … — baseline NON-EMPTY,
 *           a debt list that may only shrink. NAME test only; see KERNEL_GLOBS
 *           for why `featureImport` is deliberately not applied there.
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
 * The KIT baseline is EMPTY. That makes it an invariant rather than a debt
 * being paid down: nobody should need a kit file that knows about a feature, so
 * any entry is a regression to fix rather than a number to watch. It reached
 * zero from 76.
 *
 * The KERNEL baseline is not empty and is not claimed to be an invariant yet —
 * it is the worklist for moving domain code (cache updaters, permission
 * helpers, the Spoonacular client, domain transforms) down into the features
 * that own it. What the gate buys today is that the number cannot grow.
 *
 *   node scripts/check-layer-purity.mjs           # check
 *   node scripts/check-layer-purity.mjs --list    # print every finding
 *   node scripts/check-layer-purity.mjs --update  # re-baseline
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

/** Aliases derived from `tsconfig.json` — the single source. */
const ALIAS_PAIRS = createRequire(import.meta.url)(
  './lib/aliases.js',
).prefixPairs();

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
 * `src/app/` is deliberately absent — the composition root exists to know the
 * feature list, so this rule would measure the wrong thing there.
 * See `src/app/README.md`.
 */
const KIT_GLOBS = ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'];
const KIT_GRAPHQL = ['src/components/**/*.graphql', 'src/hooks/**/*.graphql'];

/**
 * The kernel: the layer BELOW the kit, which a sibling app keeps unchanged.
 * NAME test only — its feature imports are load-bearing (offline queue, i18n
 * bundling, the subscription layer) and governed by `import/no-restricted-paths`
 * in `.eslintrc.js`. A module NAMED after a feature is an unambiguous fork cost.
 */
const KERNEL_GLOBS = [
  'src/apollo/**/*.{ts,tsx}',
  'src/store/**/*.{ts,tsx}',
  'src/services/**/*.{ts,tsx}',
  'src/navigation/**/*.{ts,tsx}',
  'src/config/**/*.{ts,tsx}',
  'src/utils/**/*.{ts,tsx}',
  'src/constants/**/*.{ts,tsx}',
  'src/theme/**/*.{ts,tsx}',
  'src/i18n/**/*.{ts,tsx}',
];

/**
 * Per-feature navigation stacks are named after features BY DESIGN — they are
 * the composition layer wiring a feature's screens into the navigator, the same
 * exemption `src/app/` gets. Naming `PantryStack.tsx` anything else would make
 * it worse, not more portable.
 */
const KERNEL_EXEMPT = [/^src\/navigation\/stacks\//];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
];

/**
 * Feature ids, read from the directory listing rather than `registry.ts`.
 * The registry is TypeScript and this script runs on bare node in CI jobs that
 * skip `npm ci`; `check-feature-shape.mjs` keeps a manifest's `id` equal to its
 * directory name, so the two agree by construction.
 */
const FEATURE_IDS = filesUnder('src/features/*/manifest.ts')
  .map(f => f.split(sep).at(-2))
  .sort();

/**
 * Domain words that are not feature directory names.
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
 * `home` collides with the tab-navigator sense (`HomeTabs`); `profile` and
 * `notifications` name concepts every app of this shape has. Excluding them
 * keeps the name test precise; real coupling still shows as `featureImport`.
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
 * A naive `[^a-z]` boundary misses the common case: in `MoveToPantryModal` the
 * character before `Pantry` is a lowercase `o`, so the term never matches and
 * the file reads as clean.
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
/** Composition-root files that reach a feature — walk targets, never findings. */
const compositionRootCouplings = new Set();

/**
 * The files the transitive walk may step through: the kit, PLUS `src/app`.
 * A kit file importing the composition root drags its feature graph into what
 * a sibling app reuses wholesale. The KERNEL is deliberately NOT walked — its
 * feature imports are load-bearing and governed by the `.eslintrc.js` zone.
 */
const COMPOSITION_ROOT_GLOBS = ['src/app/**/*.{ts,tsx}'];
const walkableFiles = [
  ...kitFiles,
  ...filesUnder(COMPOSITION_ROOT_GLOBS, { exclude: SKIP }),
];
const kitFileSet = new Set(kitFiles.map(f => relative(REPO_ROOT, f)));
const walkableSet = new Set(walkableFiles.map(f => relative(REPO_ROOT, f)));
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

// Aliases come from `tsconfig.json` through the shared derivation, so this
// cannot drift the way a hand-written table would.
const resolveToKitFile = (spec, fromRel) => {
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
    if (walkableSet.has(candidate)) return candidate;
  }
  return null;
};

/** Walkable file -> the walkable files it imports. Built once, walked below. */
const kitImports = new Map();

// The composition root is scanned for edges and for its OWN feature imports,
// but never reported: it is exempt by design.
for (const file of filesUnder(COMPOSITION_ROOT_GLOBS, { exclude: SKIP })) {
  const rel = relative(REPO_ROOT, file);
  const specs = importsOf(readFileSync(file, 'utf8'));
  if (specs.some(s => REACHES_FEATURE.test(s) || RELATIVE_FEATURE.test(s))) {
    compositionRootCouplings.add(rel);
  }
  kitImports.set(
    rel,
    specs
      .map(spec => resolveToKitFile(spec, rel))
      .filter(target => target !== null && target !== rel),
  );
}

for (const file of kitFiles) {
  const rel = relative(REPO_ROOT, file);
  const source = readFileSync(file, 'utf8');
  const specs = importsOf(source);

  if (specs.some(s => REACHES_FEATURE.test(s) || RELATIVE_FEATURE.test(s))) {
    record(rel, 'featureImport');
  }
  if (namesDomain(rel)) record(rel, 'featureName');
  if (specs.some(s => SCHEMA_TYPES.test(s))) schemaTypeFiles.add(rel);

  kitImports.set(
    rel,
    specs
      .map(spec => resolveToKitFile(spec, rel))
      .filter(target => target !== null && target !== rel),
  );
}

/**
 * A kit file that reaches a feature THROUGH another kit file is coupled too:
 * what a sibling app reuses wholesale is the transitive closure, not the first
 * edge. Only edges INSIDE the kit are followed — a feature importing another
 * feature is that layer's business, and the kernel has its own rule.
 */
const directlyCoupled = new Set([
  ...[...findings.keys()].filter(rel => findings.get(rel).has('featureImport')),
  ...compositionRootCouplings,
]);

for (const rel of kitFileSet) {
  if (directlyCoupled.has(rel)) continue;
  const seen = new Set([rel]);
  const stack = [...(kitImports.get(rel) ?? [])];
  while (stack.length) {
    const next = stack.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    if (directlyCoupled.has(next)) {
      record(rel, 'featureImportVia');
      break;
    }
    stack.push(...(kitImports.get(next) ?? []));
  }
}

for (const file of filesUnder(KIT_GRAPHQL, { exclude: SKIP })) {
  record(relative(REPO_ROOT, file), 'ownsGraphql');
}

const kernelFiles = filesUnder(KERNEL_GLOBS, { exclude: SKIP });

requireNonEmptyScan({
  count: kernelFiles.length,
  what: 'kernel files',
  check: 'check-layer-purity',
  hint: 'a top-level src/ directory moved, or the glob no longer matches',
  minimum: 100,
});

const kernelFindings = new Map(); // relPath -> term it is named after
for (const file of kernelFiles) {
  const rel = relative(REPO_ROOT, file);
  if (KERNEL_EXEMPT.some(re => re.test(rel))) continue;
  const term = namesDomain(rel);
  if (term) kernelFindings.set(rel, term);
}
const currentKernel = [...kernelFindings.keys()].sort();

const current = [...findings.keys()].sort();
const recorded = BASELINE.exists() ? BASELINE.read().files ?? [] : [];

if (flags.list) {
  for (const rel of current) {
    console.log(`${[...findings.get(rel)].sort().join(',').padEnd(34)} ${rel}`);
  }
  for (const rel of currentKernel) {
    console.log(`${`kernelName:${kernelFindings.get(rel)}`.padEnd(34)} ${rel}`);
  }
  console.log(
    `\n${current.length} kit file(s) coupled to a feature.` +
      `\n${currentKernel.length} kernel file(s) named after a feature.` +
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
    kernelFiles: currentKernel,
    schemaTypeImporters: [...schemaTypeFiles].sort(),
    scannedFiles: kitFiles.length,
  });
  console.log(
    `Recorded ${current.length} coupled kit file(s) from ${kitFiles.length} scanned, ` +
      `and ${currentKernel.length} domain-named kernel file(s) from ${kernelFiles.length}.`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-layer-purity');
const { added, removed } = diffSets(current, baseline.files ?? []);
const kernelDiff = diffSets(currentKernel, baseline.kernelFiles ?? []);

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

if (kernelDiff.added.length) {
  console.error(
    `\n✗ check-layer-purity: ${kernelDiff.added.length} kernel file(s) newly named after a feature.\n`,
  );
  for (const rel of kernelDiff.added) {
    console.error(`    ${kernelFindings.get(rel).padEnd(30)} ${rel}`);
  }
  console.error(
    `\n  The kernel is what a sibling app keeps unchanged. A module here named\n` +
      `  after a domain is that feature's code sitting below the layer that is\n` +
      `  meant to be domain-free — move it into src/features/<name>/.\n\n` +
      `  A feature store must also call registerSessionScopedStore(): the root\n` +
      `  store's SESSION_SCOPED_STATE cannot reach it, which is how the recipe\n` +
      `  caches came to survive a sign-out.\n`,
  );
  process.exit(1);
}

console.log(
  `check-layer-purity: ${current.length} coupled kit file(s), ` +
    `baseline ${baseline.files.length}` +
    (removed.length ? ` (${removed.length} cleared — run --update)` : '') +
    `.\ncheck-layer-purity: ${currentKernel.length} domain-named kernel file(s), ` +
    `baseline ${(baseline.kernelFiles ?? []).length}` +
    (kernelDiff.removed.length
      ? ` (${kernelDiff.removed.length} cleared — run --update)`
      : '') +
    `.\n${schemaTypeFiles.size} import generated schema types (tracked).`,
);
