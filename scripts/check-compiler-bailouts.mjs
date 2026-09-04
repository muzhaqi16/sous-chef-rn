/**
 * Fails when more components silently skip React Compiler compilation than the
 * recorded baseline allows.
 *
 * A bailout is invisible by design: the compiler skips the function and the
 * build succeeds, so a component simply stops being memoized with nothing to
 * see. That matters here because the project's rules against `useMemo`,
 * `useCallback` and `React.memo` all rest on the compiler covering those cases
 * — where it bails, the rule removes the fallback and leaves nothing.
 *
 * No linter can catch this. ESLint reads the original source, while the bailout
 * is introduced downstream by another Babel plugin rewriting that source before
 * the compiler sees it. Compiling the file is the only way to know, which is
 * what this does.
 *
 *   node scripts/check-compiler-bailouts.mjs           # check against baseline
 *   node scripts/check-compiler-bailouts.mjs --update  # record a new baseline
 *   node scripts/check-compiler-bailouts.mjs --list    # print offending files
 */
import babel from '@babel/core';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  baselineFile,
  filesUnder,
  fromRoot,
  REPO_ROOT,
  requireNonEmptyScan,
} from './lib/tooling.mjs';

const BASELINE = baselineFile(
  fromRoot('scripts', 'check-compiler-bailouts.baseline.json'),
);
const UPDATE = process.argv.includes('--update');
const LIST = process.argv.includes('--list');

const files = filesUnder(['src/**/*.ts', 'src/**/*.tsx'], {
  exclude: [
    /(^|\/)(__tests__|__mocks__|generated)(\/|$)/,
    /\.(test|spec)\.tsx?$/,
    /\.generated\.ts$/,
  ],
});
const failures = [];

/**
 * `'use no memo'` — the OTHER way out of compiler coverage: voluntary, same
 * outcome as a bailout, so tracked too. Never the right fix — a frozen variant
 * means the `babel.config.js` plugin order broke, so repair the toolchain
 * (`probe-unistyles-compiler-order.mjs`). `noMemoOptOuts` is EMPTY, shrink-only.
 */
const OPT_OUT_DIRECTIVE = /^\s*['"]use no memo['"]\s*;?\s*$/;
const optOuts = [];
let compiled = 0;
let succeeded = 0;

/**
 * Name the function a bailout happened in, from the compiler's `fnLoc`. This is
 * what makes the baseline actionable: a bailout in a leaf extracted to hold a
 * `useVariants` call costs nothing, while the same bailout in the composite
 * that renders a list unmemoizes that whole subtree.
 */
function functionNameAt(lines, line) {
  // A NAMED declaration wins outright, however far back it is within the
  // window: scanning line-by-line for "anything function-shaped" picked up a
  // destructured prop (`onPress`) sitting between the directive and the
  // component that actually owns it, which named the wrong thing in a report
  // whose whole value is naming the right one.
  const NAMED =
    /(?:export\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)|(?:^|\s)([A-Z][\w$]*)\s*[:=]\s*(?:async\s*)?(?:\(|function|React\.)/;
  const LOOSE = /([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?(?:\(|function)/;

  let loose;
  for (let i = line - 1; i >= 0 && i > line - 30; i--) {
    const text = lines[i] ?? '';
    const named = NAMED.exec(text);
    if (named) return named[1] ?? named[2];
    if (!loose) {
      const m = LOOSE.exec(text);
      if (m) loose = m[1];
    }
  }
  return loose ?? '<anonymous>';
}

for (const file of files) {
  let sawEvent = false;
  const reasons = [];
  const bailedFns = [];
  // Everything recorded is repo-relative: the baseline is committed, so an
  // absolute path would make it machine-specific.
  const rel = relative(REPO_ROOT, file);
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  try {
    await babel.transformAsync(source, {
      filename: file,
      cwd: REPO_ROOT,
      configFile: './babel.config.js',
      caller: { name: 'compiler-bailout-check', supportsStaticESM: true },
      plugins: [
        [
          'babel-plugin-react-compiler',
          {
            logger: {
              logEvent(_filename, event) {
                sawEvent = true;
                if (event.kind === 'CompileSuccess') succeeded++;
                if (event.kind === 'CompileError') {
                  reasons.push(
                    event.detail?.reason ??
                      event.detail?.description ??
                      'unknown',
                  );
                  const line = event.fnLoc?.start?.line;
                  bailedFns.push(
                    line ? functionNameAt(lines, line) : '<unknown>',
                  );
                }
              },
            },
          },
        ],
      ],
    });
  } catch (error) {
    // A file Babel cannot parse at all is a different problem, and a louder
    // one — surface it rather than counting it as a bailout.
    console.error(`\n✗ ${file} failed to transform:\n  ${error.message}\n`);
    process.exit(2);
  }
  lines.forEach((text, i) => {
    if (OPT_OUT_DIRECTIVE.test(text)) {
      optOuts.push({ file: rel, fn: functionNameAt(lines, i + 1) });
    }
  });

  if (sawEvent) compiled++;
  if (reasons.length) {
    failures.push({
      file: rel,
      reasons: [...new Set(reasons)],
      fns: [...new Set(bailedFns)],
    });
  }
}

// A run that compiled nothing must not look like a clean run. This is the same
// vacuity trap the checks in this change exist to close.
requireNonEmptyScan({
  count: compiled,
  what: `files reaching the compiler (of ${files.length} scanned)`,
  check: 'check-compiler-bailouts',
  hint: 'the Babel config or preset changed and the compiler emitted no events.',
});

const count = failures.length;
const optOutKeys = [...new Set(optOuts.map(o => `${o.file} → ${o.fn}`))].sort();
console.log(
  `Scanned ${files.length} files · ${compiled} reached the compiler · ` +
    `${succeeded} functions compiled · ${count} files with bailouts · ` +
    `${optOutKeys.length} \`use no memo\` opt-out(s)`,
);

if (LIST || UPDATE) {
  for (const f of failures) {
    console.log(
      `  ${f.file}\n    in: ${f.fns.join(', ')}\n    ${f.reasons.join('; ')}`,
    );
  }
}

const existingBaseline = BASELINE.read() ?? {};

if (UPDATE) {
  BASELINE.write({
    maxFilesWithBailouts: count,
    files: failures.map(f => f.file).sort(),
    // Preserved across updates: `isolatedLeaves` records WHICH function is
    // expected to bail where a variant call was deliberately extracted.
    isolatedLeaves: existingBaseline.isolatedLeaves ?? {},
    noMemoOptOuts: optOutKeys,
  });
  console.log(`\nBaseline updated: ${count} files.`);
  process.exit(0);
}

const baseline = BASELINE.require('check-compiler-bailouts');

/**
 * Files where the variant call was deliberately extracted into a leaf, so only
 * the leaf bails and the composite around it stays memoized. The file COUNT
 * cannot protect this — moving the call back into the composite leaves the
 * count unchanged, so the baseline records WHICH function bails.
 */
const isolated = baseline.isolatedLeaves ?? {};
// No baseline file means the rule is an invariant: nothing may bail out.
const maxFilesWithBailouts = baseline.maxFilesWithBailouts ?? 0;
const regressed = Object.entries(isolated).filter(([file, expected]) => {
  const found = failures.find(f => f.file === file);
  if (!found) return false; // the file stopped bailing entirely — fine
  return expected.some(name => !found.fns.includes(name));
});

if (regressed.length > 0) {
  console.error(
    `\n✗ A composite that had its variant call extracted is bailing again:\n`,
  );
  for (const [file, expected] of regressed) {
    const found = failures.find(f => f.file === file);
    console.error(
      `  ${file}\n    expected the bailout in: ${expected.join(', ')}` +
        `\n    now bails in:            ${found.fns.join(', ')}`,
    );
  }
  console.error(
    `\nThe leaf was extracted so the component around it stays memoized. Put the\n` +
      `\`styles.useVariants(...)\` call back in the leaf, or update\n` +
      `\`isolatedLeaves\` in the baseline if the extraction is being abandoned.`,
  );
  process.exit(1);
}

if (count > maxFilesWithBailouts) {
  const known = new Set(baseline.files ?? []);
  console.error(
    `\n✗ ${count} files bail out, baseline allows ${maxFilesWithBailouts}.\n` +
      `New since the baseline:`,
  );
  for (const f of failures.filter(x => !known.has(x.file))) {
    console.error(
      `  ${f.file}\n    in: ${f.fns.join(', ')}\n    ${f.reasons.join('; ')}`,
    );
  }
  console.error(
    `\nThe compiler skipped these, so they are not memoized — and the project's\n` +
      `rules against useMemo/useCallback/React.memo assume it did not skip them.\n` +
      `If MANY files bail at once, check the plugin order in babel.config.js —\n` +
      `babel-plugin-react-compiler must run BEFORE react-native-unistyles/plugin.\n` +
      `The reverse order makes Unistyles' useVariants transform unlowerable and\n` +
      `fails ~63 files at once.\n\n` +
      `For a single file, rewrite the construct the compiler named above — the\n` +
      `usual causes are a try/finally or a catch-less try, and value blocks\n` +
      `(?., ??, &&, ||, ternary) inside a try body. See src/utils/finallyHelpers.ts\n` +
      `and CLAUDE.md § React Compiler.`,
  );
  process.exit(1);
}

// The opt-out ratchet. Same rule as the bailout count: it may shrink, never
// grow. A new `'use no memo'` is a deliberate exit from compiler coverage, so
// it is recorded here and argued for in review rather than appearing silently.
const knownOptOuts = new Set(baseline.noMemoOptOuts ?? []);
const newOptOuts = optOutKeys.filter(k => !knownOptOuts.has(k));
if (newOptOuts.length > 0) {
  console.error(
    `\n✗ ${newOptOuts.length} new \`use no memo\` opt-out(s) — a function ` +
      `leaving React Compiler coverage:\n`,
  );
  for (const k of newOptOuts) console.error(`  ${k}`);
  console.error(
    `\nRemove it. \`noMemoOptOuts\` is empty on purpose and may only shrink.\n\n` +
      `If you added it because a \`styles.useVariants(...)\` read was freezing at\n` +
      `its first-render value, that is a TOOLCHAIN regression, not a property of\n` +
      `the component: babel.config.js must run Unistyles ->\n` +
      `unistyles-scope-crawl -> React Compiler, in that order.\n\n` +
      `  node scripts/probe-unistyles-compiler-order.mjs\n\n` +
      `Opting the component out hides that regression everywhere else it applies,\n` +
      `and costs the component its memoization. See\n` +
      `check-unistyles-variant-staleness.mjs.\n`,
  );
  process.exit(1);
}

const removedOptOuts = [...knownOptOuts].filter(k => !optOutKeys.includes(k));
if (removedOptOuts.length > 0) {
  console.log(
    `\n✓ ${removedOptOuts.length} \`use no memo\` opt-out(s) removed since ` +
      `the baseline — run --update to ratchet down:`,
  );
  for (const k of removedOptOuts) console.log(`  ${k}`);
}

if (count < maxFilesWithBailouts) {
  console.log(
    `\n✓ ${maxFilesWithBailouts - count} fewer than baseline. ` +
      `Run with --update to ratchet it down.`,
  );
} else {
  console.log('\n✓ No new bailouts.');
}
