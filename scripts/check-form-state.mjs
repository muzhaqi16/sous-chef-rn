#!/usr/bin/env node
/**
 * Fails when a form holds its fields in component state instead of the
 * schema-validated form library.
 *
 * ## The rule
 *
 * `CLAUDE.md` § Forms & validation: validation lives in a yup schema next to
 * the form, resolved through `yupResolver` on `useForm`, with fields rendered
 * through `Controller`. 29 forms do not — more than the 13 that do.
 *
 * The cost is not style. A `useState` form re-implements, badly or not at all:
 * per-field error display, the cross-field `trigger`, the paged-form
 * field-to-page map, dirty tracking, and lazy message resolution so a language
 * change reaches the copy. Each one is a rule this repo already wrote down
 * after getting it wrong.
 *
 * ## What counts
 *
 * A module under a form-shaped path with three or more `useState` declarations
 * and no `useForm`. Three is the threshold because two pieces of local state
 * beside a real form (a sheet's open flag, a submitting flag) are ordinary.
 *
 * The heuristic is deliberately shallow: it counts declarations, it does not
 * decide whether a given `useState` holds a field. A file it names might be
 * holding three unrelated flags — that is what the baseline is for. What it
 * cannot do is miss a new hand-rolled form, and that is the property worth
 * having.
 *
 * The baseline is a DEBT LIST that may only shrink — except when the SCAN
 * widens, which is not the same thing: more files seen is coverage, and hiding
 * them would be the regression. It widened twice, both times because a move
 * made a form invisible: a component whose name is not form-shaped, and a
 * hook holding the state a screen used to.
 *
 *   node scripts/check-form-state.mjs           # check
 *   node scripts/check-form-state.mjs --list    # print every finding
 *   node scripts/check-form-state.mjs --update  # re-baseline
 *   node scripts/check-form-state.mjs --self-test
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
  fromRoot('scripts/check-form-state.baseline.json'),
);

/** Where a form lives: a screen, or a file named for one. */
const FORM_GLOBS = [
  'src/features/*/screens/**/*.tsx',
  // A `.ts` beside the screen too. `RecipeForm/useRecipeForm.ts` held twenty-one
  // fields and a hand-rolled `validate()` and no glob reached it: it is not a
  // `.tsx`, and it is under `screens/`, not `hooks/`.
  'src/features/*/screens/**/*.ts',
  // Every feature component, not the form-SHAPED names only. A form's fields
  // are named for the field, so `RecipeTagsSection` and `EditableField` read as
  // ordinary components — and moving one out of `screens/` used to take it out
  // of this scan entirely, which is how the widening was found.
  'src/features/*/components/**/*.tsx',
  // A hook too: extracting a form's state out of the screen moves the finding,
  // it does not answer it.
  'src/features/*/hooks/**/*.ts',
  'src/features/*/hooks/**/*.tsx',
  'src/features/*/ui/**/*Form*.tsx',
  'src/features/*/ui/**/*Sheet*.tsx',
  'src/screens/**/*.tsx',
  'src/components/**/*Form*.tsx',
  'src/components/**/*Sheet*.tsx',
  'src/components/**/*Modal*.tsx',
];

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /\.test\.tsx?$/,
];

/** Two flags beside a real form are ordinary; three fields are a form. */
const THRESHOLD = 3;

const USE_STATE = /\buseState\s*[<(]/g;
const USE_FORM = /\buseForm\s*[<(]/;

export function assess(source) {
  const stateCount = (source.match(USE_STATE) ?? []).length;
  return {
    stateCount,
    usesFormLibrary: USE_FORM.test(source),
    handRolled: stateCount >= THRESHOLD && !USE_FORM.test(source),
  };
}

if (process.argv.includes('--self-test')) {
  const cases = [
    ['const [a, setA] = useState(1);', false],
    ['useState(1); useState(2);', false],
    ['useState(1); useState(2); useState(3);', true],
    ['useState<string>(); useState(2); useState(3);', true],
    // A real form with incidental local state is not a finding.
    ['const f = useForm(); useState(1); useState(2); useState(3);', false],
    [
      'const f = useForm<Shape>({}); useState(1); useState(2); useState(3);',
      false,
    ],
  ];
  let failed = false;
  for (const [source, expected] of cases) {
    const got = assess(source).handRolled;
    if (got !== expected) {
      console.error(
        `✗ Self-test failed for ${JSON.stringify(
          source,
        )}: expected ${expected}, got ${got}.`,
      );
      failed = true;
    }
  }
  if (failed) process.exit(2);
  console.log(
    `✓ Self-test passed: ${THRESHOLD}+ useState without useForm is a finding,\n` +
      '  and a real form with incidental local state is not.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const files = filesUnder(FORM_GLOBS, { exclude: SKIP });

requireNonEmptyScan({
  count: files.length,
  what: 'form-shaped files',
  check: 'check-form-state',
  hint: 'a screens/ or components/ directory moved, or the globs no longer match',
  minimum: 50,
});

const findings = new Map(); // relPath -> useState count
for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  const { handRolled, stateCount } = assess(readFileSync(file, 'utf8'));
  if (handRolled) findings.set(rel, stateCount);
}

const current = [...findings.keys()].sort();

if (flags.list) {
  for (const rel of [...findings.keys()].sort(
    (a, b) => findings.get(b) - findings.get(a),
  )) {
    console.log(`${String(findings.get(rel)).padStart(3)} useState  ${rel}`);
  }
  console.log(
    `\n${current.length} form(s) hold their fields in component state.` +
      `\n${files.length} form-shaped file(s) scanned.`,
  );
  process.exit(0);
}

const recorded = BASELINE.exists() ? BASELINE.read().files ?? [] : [];

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-form-state',
  });
  BASELINE.write({
    files: current,
    stateCounts: Object.fromEntries(
      [...findings.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    scannedFiles: files.length,
  });
  console.log(
    `Recorded ${current.length} hand-rolled form(s) from ${files.length} scanned.`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-form-state');
const { added, removed } = diffSets(current, baseline.files ?? []);

if (added.length) {
  console.error(
    `\n✗ check-form-state: ${added.length} form(s) newly hold their fields in component state.\n`,
  );
  for (const rel of added) {
    console.error(
      `    ${String(findings.get(rel)).padStart(3)} useState  ${rel}`,
    );
  }
  console.error(
    `\n  A form's state belongs to react-hook-form, with its rules in a yup\n` +
      `  schema beside it and fields rendered through Controller — see\n` +
      `  CLAUDE.md § Forms & validation.\n\n` +
      `  If this file's state is not form fields, re-baseline deliberately\n` +
      `  with --update and say so in the file.\n`,
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-form-state: ${removed.length} baselined form(s) are on the form library now.\n`,
  );
  for (const rel of removed) console.error(`    ${rel}`);
  console.error(`\n  Record it: node scripts/check-form-state.mjs --update\n`);
  process.exit(1);
}

console.log(
  `check-form-state: ${current.length} form(s) hold their fields in component ` +
    `state, baseline ${baseline.files?.length ?? 0}.`,
);
