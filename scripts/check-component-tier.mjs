#!/usr/bin/env node
/**
 * Fails when a component sits in the wrong tier of the kit.
 *
 * ## The rule, from `src/components/atoms/README.md`
 *
 *   atom       renders at most ONE other kit component
 *   molecule   renders SEVERAL atoms, and no molecule or organism
 *   organism   composes molecules, or owns a bottom sheet
 *   template   page-level scaffolding; not checked here
 *
 * ## Why a check
 *
 * The taxonomy was documentation, and documentation drifted: `base/` held 25
 * components beside `atoms/` with no rule separating them, `Button` was in one
 * and `IconButton` in the other, and the README's own examples contradicted its
 * own rule. A tier a script can compute is one that cannot drift, and it is
 * what makes "where does this go" answerable without reading the file.
 *
 * A tier is read from what a file RENDERS — a JSX tag whose name it imports
 * from the kit — not from what it imports, because a type import composes
 * nothing.
 *
 *   node scripts/check-component-tier.mjs           # check
 *   node scripts/check-component-tier.mjs --list    # print every finding
 *   node scripts/check-component-tier.mjs --update  # re-baseline
 *   node scripts/check-component-tier.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

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
  fromRoot('scripts/check-component-tier.baseline.json'),
);

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /\.test\.tsx?$/,
  /\.perf-test\.tsx$/,
  /\.d\.ts$/,
  // A context, a registry or a style module is not a component in the
  // taxonomy — the tiers describe what RENDERS.
  /Context\.tsx$/,
  /(^|\/)[a-z][A-Za-z0-9]*\.tsx$/,
];

/** Where a kit component is imported from, by the specifier it uses. */
const TIER_OF_SPECIFIER =
  /#components\/(atoms|molecules|organisms|templates)\//;

/** JSX tags a file renders, excluding namespaced ones like `Animated.View`. */
const renderedTags = source =>
  new Set([...source.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map(m => m[1]));

/**
 * The tier each rendered tag comes from, for tags this file imports from the
 * kit. A tag imported relatively resolves through the importing file's own
 * folder, which is its tier.
 */
export function composedTiers(source, rel) {
  const ownTier = rel.match(/src\/components\/(\w+)\//)?.[1];
  const tiers = [];
  for (const tag of renderedTags(source)) {
    const spec = new RegExp(`import[^;]*\\b${tag}\\b[^;]*from '([^']+)'`).exec(
      source,
    )?.[1];
    if (!spec) continue;
    // A relative specifier resolves against this file's folder, so `../atoms/X`
    // is an atom even though the importer is a molecule.
    const resolved = spec.startsWith('.')
      ? relative(REPO_ROOT, resolve(dirname(fromRoot(rel)), spec))
      : spec;
    const tier =
      TIER_OF_SPECIFIER.exec(resolved)?.[1] ??
      /src\/components\/(\w+)\//.exec(resolved)?.[1] ??
      (spec.startsWith('.') ? ownTier : undefined);
    if (tier) tiers.push(tier);
  }
  return tiers;
}

/**
 * Rendering the shell IS owning a sheet — `Sheet` holds the modal now, so a
 * consumer no longer names `BottomSheetModal` itself.
 */
const ownsSheet = source =>
  /\bBottomSheetModal\b/.test(source) ||
  /\buseStandardBottomSheet\b/.test(source) ||
  /<Sheet[\s/>]/.test(source);

/** The tier a file's own composition puts it in. */
export function tierFor(source, rel) {
  if (ownsSheet(source)) return 'organisms';
  const tiers = composedTiers(source, rel);
  if (tiers.some(t => t === 'organisms')) return 'organisms';
  // Wrapping ONE molecule is a preset (`EmailInput` over `BaseInput`); it takes
  // that molecule's tier. Composing several is where an organism starts.
  const molecules = tiers.filter(t => t === 'molecules').length;
  if (molecules >= 2) return 'organisms';
  if (molecules === 1) return 'molecules';
  return tiers.length >= 2 ? 'molecules' : 'atoms';
}

if (process.argv.includes('--self-test')) {
  const cases = [
    [
      'src/components/atoms/A.tsx',
      "import { Text } from './Text';\nconst A = () => <Text />;",
      'atoms',
    ],
    [
      'src/components/atoms/B.tsx',
      "import { Text } from '#components/atoms/Text';\nimport { Badge } from '#components/atoms/Badge';\nconst B = () => (<><Text /><Badge /></>);",
      'molecules',
    ],
    // One molecule is a preset; two is an organism.
    [
      'src/components/molecules/C.tsx',
      "import { Header } from '#components/molecules/Header';\nconst C = () => <Header />;",
      'molecules',
    ],
    [
      'src/components/molecules/C2.tsx',
      "import { Header } from '#components/molecules/Header';\nimport { Toast } from '#components/molecules/Toast';\nconst C2 = () => (<><Header /><Toast /></>);",
      'organisms',
    ],
    [
      'src/components/molecules/D.tsx',
      "import { BottomSheetModal } from '#hooks/useStandardBottomSheet';\nconst D = () => <BottomSheetModal />;",
      'organisms',
    ],
    [
      'src/components/molecules/D2.tsx',
      "import { Sheet } from '#components/templates/Sheet';\nconst D2 = () => <Sheet />;",
      'organisms',
    ],
    // A type import composes nothing.
    [
      'src/components/atoms/E.tsx',
      "import type { TextProps } from '#components/atoms/Text';\nimport { Badge } from '#components/atoms/Badge';\nconst E = () => <Badge />;",
      'atoms',
    ],
  ];
  let failed = false;
  for (const [rel, source, expected] of cases) {
    const got = tierFor(source, rel);
    if (got !== expected) {
      console.error(
        `✗ Self-test failed for ${rel}: expected ${expected}, got ${got}.`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(2);
  console.log(
    '✓ Self-test passed: one composition is an atom, several a molecule, a\n' +
      '  molecule or a sheet an organism, and a type import composes nothing.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const files = filesUnder(
  ['src/components/{atoms,molecules,organisms}/**/*.tsx'],
  {
    exclude: SKIP,
  },
);

requireNonEmptyScan({
  count: files.length,
  what: 'kit components',
  check: 'check-component-tier',
  hint: 'src/components moved, or a bucket was renamed',
  minimum: 50,
});

/**
 * A component FAMILY is a folder named after its entry file
 * (`SwipeableItem/SwipeableItem.tsx`). Its parts are internal to the family and
 * take the family's tier, so only the entry is classified.
 */
const isFamilyPart = rel => {
  const parts = rel.split('/');
  const dir = parts.at(-2);
  const base = parts.at(-1).replace(/\.tsx$/, '');
  return !['atoms', 'molecules', 'organisms'].includes(dir) && dir !== base;
};

const findings = [];
for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  if (isFamilyPart(rel)) continue;
  const actual = rel.match(/src\/components\/(\w+)\//)?.[1];
  const expected = tierFor(readFileSync(file, 'utf8'), rel);
  if (actual !== expected) findings.push(`${rel} :: ${actual} → ${expected}`);
}

const current = [...findings].sort();

if (flags.list) {
  for (const f of current) console.log(`  ${f}`);
  console.log(
    `\n${current.length} misplaced across ${files.length} components.`,
  );
  process.exit(0);
}

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: (BASELINE.exists() ? BASELINE.read().misplaced ?? [] : [])
      .length,
    check: 'check-component-tier',
  });
  BASELINE.write({ misplaced: current, scanned: files.length });
  console.log(`Recorded ${current.length} misplaced component(s).`);
  process.exit(0);
}

const baseline = BASELINE.require('check-component-tier');
const { added, removed } = diffSets(current, baseline.misplaced ?? []);

if (added.length) {
  console.error(
    `\n✗ check-component-tier: ${added.length} component(s) in the wrong tier.\n`,
  );
  for (const f of added) console.error(`    ${f}`);
  console.error(
    '\n  An atom renders at most one other kit component; a molecule renders\n' +
      '  several atoms; an organism composes molecules or owns a sheet.\n' +
      '  See src/components/atoms/README.md.\n',
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-component-tier: ${removed.length} baselined component(s) are placed right now.\n`,
  );
  for (const f of removed) console.error(`    ${f}`);
  console.error(
    '\n  Record it: node scripts/check-component-tier.mjs --update\n',
  );
  process.exit(1);
}

console.log(
  `check-component-tier: ${current.length} misplaced across ${files.length} ` +
    `components, baseline ${(baseline.misplaced ?? []).length}.`,
);
