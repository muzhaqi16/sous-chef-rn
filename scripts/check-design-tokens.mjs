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
    id: 'colour-literal',
    // TRACKED, not failing: half of these need a token that does not exist yet
    // (three more scrim depths, a light-scrim family, a ripple family), and two
    // are a colour decision rather than a substitution — the star's amber and
    // the scanner's edge. A rule whose token is missing is a rule people work
    // around, so the number is reported until the tokens land.
    tracked: true,
    token: 'a theme.colors token',
    why: 'A literal colour does not follow the colour scheme, so it is the one thing on screen that stays light in the dark theme. Over a ground the theme does not paint — a photo, a camera preview — the role is `onScrim`.',
    detect: colourLiteral,
    // The theme, and the four DATA palettes: a colour the person PICKS is
    // content, not styling, and a token set cannot enumerate it. Each is a
    // fixed list the user chooses from, or an illustration's own paint.
    owns: [
      /^src\/theme\//,
      // The brand identity a rebrand edits in one place.
      /^src\/config\/appConfig\.ts$/,
      // The storage-location colour choices, stored per location.
      /^src\/features\/catalog\/components\/storageLocationFormConfig\.ts$/,
      // The accent-colour picker's swatches.
      /^src\/features\/profile\/screens\/AppearanceScreen\.tsx$/,
      // An illustration's palette: the loader draws a paper bag and a tomato.
      /^src\/components\/atoms\/SousChefLoader\.tsx$/,
    ],
  },
  {
    id: 'icon-size-literal',
    // TRACKED, not failing: 334 sites across 161 files, of which 221 already
    // write a value the scale HAS (16/20/24/32/48/64) and 113 sit between
    // steps. The first group is a codemod, the second a per-site decision; both
    // are larger than one change, and the count is the target for that work.
    tracked: true,
    token:
      'a named step of the matching theme.sizes scale (icon, avatar, button)',
    why: 'A literal size does not move with the density setting, and an off-scale one is a size only this call site has — 18, 14 and 22 all sit between named icon steps. Any `size={N}` prop counts, so an avatar or a control height is a finding against its own scale.',
    detect: /\bsize=\{[0-9]+\}/,
    owns: [/^src\/theme\//],
  },
  {
    id: 'motion-duration-literal',
    token: 'a step of theme.motion.timing',
    why: 'A transition duration is a whole-app decision. A number above the scale is a LOOP period (a 1500ms shimmer, a 1200ms bob) and stays a literal — the scale stops at 300ms because nothing shorter is a loop.',
    detect: shortDuration,
    owns: [/^src\/theme\//],
  },
  {
    id: 'kit-concept-restyled',
    token: 'the kit component for the concept',
    why: 'A section header, an empty state or a divider RESTYLED here is one that will not follow when the shared one changes.',
    // The name alone is not the finding: `SectionHeader` and `EmptyState` both
    // take a `style` for placement, so a block holding only margins is the
    // documented way to use them. What cannot follow the kit is a block that
    // re-declares the TYPE or COLOUR — a second definition of the treatment.
    detect: restyledKitConcept,
    owns: [/^src\/components\//, /^src\/theme\//, /^src\/styles\//],
  },
];

/**
 * A colour written out rather than named. The hex form is anchored between
 * MATCHING quotes because `'#features/...'` is an import alias, not a colour —
 * `#fea` is three hex digits followed by a path.
 */
const COLOUR_LITERAL =
  /(['"])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\1|\b(?:rgba?|hsla?)\(/;

export function colourLiteral(source) {
  return COLOUR_LITERAL.test(source);
}

/**
 * The motion scale stops at 300ms, so a duration at or below it is a
 * TRANSITION and has a token. Above it is a loop's own period, which no
 * animation shares and which the scale deliberately does not carry.
 */
const MOTION_SCALE_CEILING_MS = 300;

export function shortDuration(source) {
  for (const match of source.matchAll(
    /\b(?:animationDuration|duration)\s*[:=]\s*([0-9]+)\b/g,
  )) {
    if (Number(match[1]) <= MOTION_SCALE_CEILING_MS) return true;
  }
  return false;
}

const CONCEPT_KEYS =
  /\b(sectionTitle|sectionHeader|sectionLabel|emptyContainer|emptyText|loadingContainer|divider|separator)\s*:\s*\{/g;

/** Type and colour — the properties the kit component owns. */
const TREATMENT =
  /\b(fontSize|fontWeight|fontFamily|fontStyle|color|textTransform|letterSpacing|lineHeight)\s*:/;

/** True when a concept-named style block re-declares the treatment itself. */
export function restyledKitConcept(source) {
  for (const match of source.matchAll(CONCEPT_KEYS)) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (depth > 0 && i < source.length) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    if (TREATMENT.test(source.slice(match.index + match[0].length, i - 1))) {
      return true;
    }
  }
  return false;
}

const FAILING_CONCERNS = CONCERNS.filter(c => !c.tracked);
const TRACKED_CONCERNS = CONCERNS.filter(c => c.tracked);

/**
 * Per tracked concern, a count that may only go DOWN. "Does not fail" must not
 * mean "may grow", or the number is an impression again. Not a baseline file:
 * this gate is promoted, and the tooling refuses to write one back.
 */
const TRACKED_CEILING = {
  'colour-literal': 9,
  'icon-size-literal': 161,
};

const violations = (rel, source) =>
  CONCERNS.filter(
    concern =>
      !concern.owns.some(re => re.test(rel)) &&
      (typeof concern.detect === 'function'
        ? concern.detect(source)
        : concern.detect.test(source)),
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
    // Placement is what `SectionHeader style={...}` is FOR; only a second
    // declaration of the treatment cannot follow the kit.
    [
      'src/features/x/H.tsx',
      'const s = { sectionTitle: { marginBottom: theme.spacing.sm } };',
      [],
    ],
    [
      'src/features/x/I.tsx',
      'const s = { sectionHeader: { fontSize: theme.fonts.size.lg } };',
      ['kit-concept-restyled'],
    ],
    [
      'src/styles/commonStyles.ts',
      'const s = { divider: { color: theme.colors.divider } };',
      [],
    ],
    // A colour the person PICKS is content: the swatch list is the data.
    [
      'src/features/x/J.tsx',
      "const s = { color: '#fff' };",
      ['colour-literal'],
    ],
    [
      'src/features/x/K.tsx',
      "const s = { backgroundColor: 'rgba(0, 0, 0, 0.6)' };",
      ['colour-literal'],
    ],
    [
      'src/features/profile/screens/AppearanceScreen.tsx',
      "const swatches = [{ hex: '#2563EB' }];",
      [],
    ],
    // `#fea` inside an import alias is three hex digits, not a colour.
    ['src/features/x/L.tsx', "import x from '#features/y';", []],
    [
      'src/features/x/M.tsx',
      'const s = <Icon size={18} />;',
      ['icon-size-literal'],
    ],
    [
      'src/features/x/N.tsx',
      'const s = <Icon size={theme.sizes.icon.sm} />;',
      [],
    ],
    // At or below the scale ceiling it is a transition and has a token.
    [
      'src/features/x/O.tsx',
      'const o = { animationDuration: 250 };',
      ['motion-duration-literal'],
    ],
    // Above it, the number is a LOOP's own period and stays a literal.
    ['src/features/x/P.tsx', 'withTiming(0, { duration: 1200 });', []],
    [
      'src/features/x/Q.tsx',
      'const o = { animationDuration: motion.timing.MODERATE };',
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

const isTracked = pair =>
  TRACKED_CONCERNS.some(c => pair.startsWith(`${c.id}::`));

/** The invariant: these must stay empty. */
const current = findings.filter(pair => !isTracked(pair)).sort();
/** Reported on every run, never failed. */
const trackedPairs = findings.filter(isTracked).sort();
const trackedCount = id =>
  trackedPairs.filter(pair => pair.startsWith(`${id}::`)).length;
const trackedSummary = TRACKED_CONCERNS.map(
  c => `${trackedCount(c.id)} ${c.id.replace('-literal', '')}`,
).join(', ');

if (flags.list) {
  // Tracked pairs are listed too — the count is only useful if the files
  // behind it can be read.
  const all = [...current, ...trackedPairs];
  for (const concern of CONCERNS) {
    const hits = all
      .filter(f => f.startsWith(`${concern.id}::`))
      .map(f => f.split('::')[1]);
    const label = concern.tracked
      ? ` (${hits.length}, tracked — ceiling ${TRACKED_CEILING[concern.id]})`
      : ` (${hits.length})`;
    console.log(`\n${concern.id}${label} — use ${concern.token}`);
    console.log(`    ${concern.why}`);
    for (const rel of hits) console.log(`      ${rel}`);
  }
  console.log(
    `\n${current.length} failing pair(s) and ${trackedPairs.length} tracked, ` +
      `across ${files.length} files.`,
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
      FAILING_CONCERNS.map(c => [
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

const grown = TRACKED_CONCERNS.filter(
  c => trackedCount(c.id) > TRACKED_CEILING[c.id],
);

if (grown.length) {
  console.error(
    `\n✗ check-design-tokens: ${grown.length} tracked concern(s) grew.\n`,
  );
  for (const concern of grown) {
    console.error(
      `    ${concern.id.padEnd(24)} ${trackedCount(concern.id)} file(s), ` +
        `ceiling ${TRACKED_CEILING[concern.id]}`,
    );
    console.error(`    ${''.padEnd(24)} use ${concern.token}`);
  }
  console.error(
    `\n  Tracked means the token does not exist yet, not that the count may\n` +
      `  grow. See TRACKED_CEILING in this file.\n`,
  );
  process.exit(1);
}

const slack = TRACKED_CONCERNS.filter(
  c => trackedCount(c.id) < TRACKED_CEILING[c.id],
);

if (slack.length) {
  console.error(
    `\n✗ check-design-tokens: ${slack.length} tracked ceiling(s) are stale.\n`,
  );
  for (const concern of slack) {
    console.error(
      `    ${concern.id.padEnd(24)} ${trackedCount(concern.id)} file(s), ` +
        `ceiling still ${TRACKED_CEILING[concern.id]}`,
    );
  }
  console.error(
    `\n  Good — lower TRACKED_CEILING in this file to the new number, so the\n` +
      `  ceiling cannot outlive the work that brought it down.\n`,
  );
  process.exit(1);
}

console.log(
  `check-design-tokens: ${current.length} literal(s) across ` +
    `${FAILING_CONCERNS.length} concerns, baseline ` +
    `${baseline.pairs?.length ?? 0}.\n` +
    `${trackedSummary} (tracked at ceiling, not failed — the tokens they need ` +
    `do not exist yet).`,
);
