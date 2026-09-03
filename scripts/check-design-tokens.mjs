#!/usr/bin/env node
/**
 * Fails when a visual property is written as a literal instead of a token, or
 * when a file outside the kit restyles a concept the kit owns.
 *
 * `border-width-literal` used to be here, at 106 files. It reached zero once
 * `theme.borderWidth` existed, so it is a `no-restricted-syntax` ban in
 * `.eslintrc.js` now — which is where every concern here ends up.
 *
 * ## Why this is a ratchet and not a lint rule (yet)
 *
 * Token adherence in this tree is already above 95% — `theme.spacing` is read
 * 2,158 times against 61 numeric padding literals — and nothing enforces it.
 * That is a habit, and a habit is one hurried change away from being a
 * precedent.
 *
 * It is a ratchet rather than a ban because a concern whose token does not exist
 * yet produces a rule people work around. Recording the number gives the token
 * work a target, and each concern becomes a `no-restricted-syntax` selector the
 * moment its list empties — as border width already has.
 *
 * ## What each concern is
 *
 * A literal is not merely untidy. A colour or a size written inline is one the
 * theme cannot change: it does not follow the colour scheme, the density
 * setting, or the text-size preference. A section header restyled inside a
 * feature is one that will not move when the kit's does.
 *
 *   node scripts/check-design-tokens.mjs           # check
 *   node scripts/check-design-tokens.mjs --list    # print every finding
 *   node scripts/check-design-tokens.mjs --update  # re-baseline
 *   node scripts/check-design-tokens.mjs --self-test
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
  fromRoot('scripts/check-design-tokens.baseline.json'),
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

/** `<property>: <number>` — a literal where a token belongs. */
const literal = property => new RegExp(`\\b${property}\\s*:\\s*[0-9]`);

export const CONCERNS = [
  {
    id: 'font-size-literal',
    token: 'theme.fonts.size',
    why: 'A literal size does not scale with the text-size preference, and does not carry the line height its role defines.',
    detect: literal('fontSize'),
    owns: [/^src\/theme\//],
  },
  {
    id: 'border-radius-literal',
    token: 'theme.radii',
    why: 'Radius is what makes surfaces look like one family; a literal is a shape only this file has.',
    detect: literal('borderRadius'),
    owns: [/^src\/theme\//],
  },
  {
    id: 'z-index-literal',
    token: 'theme.zIndex',
    why: 'Layer order is a whole-app decision. A literal orders this file against numbers it cannot see.',
    detect: literal('zIndex'),
    owns: [/^src\/theme\//],
  },
  {
    id: 'spacing-arithmetic',
    token: 'a named step of theme.spacing',
    why: 'Adding to a token is the scale asking for a step it does not have. The step is the fix, not the arithmetic.',
    detect:
      /theme\.spacing(?:\.[a-zA-Z0-9]+|\[['"][^'"]+['"]\])\s*[-+*]\s*[0-9]/,
    owns: [/^src\/theme\//],
  },
  {
    id: 'kit-concept-restyled',
    token: 'the kit component for the concept',
    why: 'A section header, an empty state or a divider styled here is one that will not follow when the shared one changes.',
    detect:
      /\b(sectionTitle|sectionHeader|sectionLabel|emptyContainer|emptyText|loadingContainer|divider|separator)\s*:\s*\{/,
    owns: [/^src\/components\//, /^src\/theme\//],
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
      'src/features/x/A.tsx',
      'const s = { fontSize: 13 };',
      ['font-size-literal'],
    ],
    ['src/theme/tokens.ts', 'const s = { fontSize: 13 };', []],
    [
      'src/features/x/B.tsx',
      'const s = { borderRadius: 18 };',
      ['border-radius-literal'],
    ],
    [
      'src/features/x/C.tsx',
      'const s = { padding: theme.spacing.xs + 2 };',
      ['spacing-arithmetic'],
    ],
    [
      'src/features/x/D.tsx',
      "const s = { padding: theme.spacing['3'] * 2 };",
      ['spacing-arithmetic'],
    ],
    [
      'src/features/x/E.tsx',
      'const s = { sectionTitle: { color: theme.colors.textPrimary } };',
      ['kit-concept-restyled'],
    ],
    [
      'src/components/molecules/F.tsx',
      'const s = { divider: { height: 1 } };',
      [],
    ],
    // A token read is the point, not a finding.
    [
      'src/features/x/G.tsx',
      'const s = { fontSize: theme.fonts.size.sm, borderRadius: theme.radii.md };',
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
  if (failed) process.exit(2);
  console.log(
    `✓ Self-test passed: ${CONCERNS.length} concerns detect a literal where a\n` +
      '  token belongs, and a token read is not a finding.',
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
  check: 'check-design-tokens',
  hint: 'src/ moved, or the glob no longer matches',
  minimum: 200,
});

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
    console.log(`\n${concern.id} (${hits.length}) — use ${concern.token}`);
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
    check: 'check-design-tokens',
  });
  BASELINE.write({
    pairs: current,
    countsByConcern: Object.fromEntries(
      CONCERNS.map(c => [
        c.id,
        current.filter(f => f.startsWith(`${c.id}::`)).length,
      ]),
    ),
    scannedFiles: files.length,
  });
  console.log(`Recorded ${current.length} pair(s) from ${files.length} files.`);
  process.exit(0);
}

const baseline = BASELINE.require('check-design-tokens');
const { added, removed } = diffSets(current, baseline.pairs ?? []);

if (added.length) {
  console.error(
    `\n✗ check-design-tokens: ${added.length} new literal(s) where a token belongs.\n`,
  );
  for (const pair of added) {
    const [id, rel] = pair.split('::');
    const concern = CONCERNS.find(c => c.id === id);
    console.error(`    ${id.padEnd(24)} ${rel}`);
    console.error(`    ${''.padEnd(24)} use ${concern.token}`);
  }
  console.error(
    `\n  A literal is a value the theme cannot change — it does not follow the\n` +
      `  colour scheme, the density setting or the text-size preference.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-design-tokens: ${removed.length} baselined literal(s) are gone.\n`,
  );
  for (const pair of removed) console.error(`    ${pair.replace('::', '  ')}`);
  console.error(
    `\n  Record it: node scripts/check-design-tokens.mjs --update\n` +
      `  When a concern reaches zero, replace it with a no-restricted-syntax\n` +
      `  selector in .eslintrc.js.\n`,
  );
  process.exit(1);
}

console.log(
  `check-design-tokens: ${current.length} literal(s) across ${CONCERNS.length} ` +
    `concerns, baseline ${baseline.pairs?.length ?? 0}.`,
);
