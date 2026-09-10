#!/usr/bin/env node
/**
 * Fails when a file outside the baseline has a condition its types say cannot
 * matter, and when a baselined file drifts further from clean.
 *
 * ## Why a check, when ESLint already runs the rule
 *
 * `.eslintrc.js` enables `@typescript-eslint/no-unnecessary-condition` for
 * `src/**` and excludes the files listed here, so lint covers the direction
 * that matters most: a new file, or a clean one going dirty. What it cannot
 * see is a BASELINED file getting worse — an excluded file is excluded whole.
 * This counts per file, so the list ratchets down instead of merely not
 * growing.
 *
 * ## What the rule buys, given tsc
 *
 * TypeScript's own TS2774 ("this function is always defined — did you mean to
 * call it?") is emitted from three positions only: an `if` condition, a ternary
 * condition, and the left operand of `&&`/`||`. It also suppresses itself when
 * the symbol is used in the body. So `!Environment.isProduction` — a method
 * read without calling it — is invisible to it: `!fn` types as `boolean`, which
 * has no call signatures, and the check returns early. This rule is what sees
 * it.
 *
 * ## Why a baseline rather than a ban
 *
 * Three quarters of the recorded findings are `?.` and null guards on GraphQL
 * data that codegen types as non-nullable and the server does not guarantee.
 * They are load-bearing. `eslint-comments/no-use` bans every disable comment,
 * so a finding is fixed or its file is listed — and a guard is never deleted to
 * satisfy the rule. An entry leaves this list when the branch is genuinely dead
 * or the type that over-promises is widened at its source.
 *
 *   node scripts/check-unnecessary-condition.mjs           # check
 *   node scripts/check-unnecessary-condition.mjs --list    # print every finding
 *   node scripts/check-unnecessary-condition.mjs --update  # re-baseline
 *   node scripts/check-unnecessary-condition.mjs --self-test
 */
import { unlinkSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';

import { ESLint } from 'eslint';

import {
  baselineFile,
  diffSets,
  fromRoot,
  parseFlags,
  refuseEmptyBaselineUpdate,
  REPO_ROOT,
  requireNonEmptyScan,
} from './lib/tooling.mjs';

const RULE = '@typescript-eslint/no-unnecessary-condition';

const BASELINE = baselineFile(
  fromRoot('scripts/check-unnecessary-condition.baseline.json'),
);

const SCAN_GLOBS = ['src/**/*.ts', 'src/**/*.tsx'];

/** Mirrors the `excludedFiles` in .eslintrc.js that are not the baseline. */
const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
  /\.d\.ts$/,
];

/**
 * The rule forced on for every file, so a baselined one is measured too — the
 * whole point of counting here rather than reading lint's exit code.
 */
const lintAll = () =>
  new ESLint({
    cwd: REPO_ROOT,
    useEslintrc: true,
    overrideConfig: { rules: { [RULE]: 'error' } },
  });

/** file → count, and file:line → messageId, for the two output modes. */
function tally(results) {
  const counts = {};
  const detail = [];
  for (const result of results) {
    const rel = relative(REPO_ROOT, result.filePath);
    if (SKIP.some(re => re.test(rel))) continue;
    const hits = result.messages.filter(m => m.ruleId === RULE);
    if (!hits.length) continue;
    counts[rel] = hits.length;
    for (const m of hits) detail.push({ rel, line: m.line, id: m.messageId });
  }
  return { counts, detail };
}

if (process.argv.includes('--self-test')) {
  // A real file on disk, because the rule is type-aware: `lintText` on a path
  // the tsconfig program never saw fails as a parser error rather than as a
  // clean run, which would read as the check passing.
  const probe = fromRoot('src/utils/__check-unnecessary-condition-probe.ts');
  writeFileSync(
    probe,
    [
      'const ready = () => true;',
      '',
      '/** The shape this check exists for: a function read, not called. */',
      'export function shouldRun(): boolean {',
      '  if (!ready) return false;',
      '  return true;',
      '}',
      '',
      'export function label(value: string | undefined): string {',
      "  return value ?? 'none';",
      '}',
      '',
    ].join('\n'),
  );

  let forced;
  let asConfigured;
  try {
    const [forcedRun] = await lintAll().lintFiles([probe]);
    forced = forcedRun.messages.filter(m => m.ruleId === RULE);
    const [plainRun] = await new ESLint({ cwd: REPO_ROOT }).lintFiles([probe]);
    asConfigured = plainRun.messages.filter(m => m.ruleId === RULE);
  } finally {
    unlinkSync(probe);
  }

  const listed = found =>
    found.map(m => `    line ${m.line}: ${m.message}`).join('\n');

  if (forced.length !== 1) {
    console.error(
      `\n✗ Self-test failed: the rule reported ${forced.length} finding(s) in ` +
        `the probe, expected exactly 1.\n${listed(forced)}\n\n` +
        `  It stopped seeing a function reference in a boolean position — the\n` +
        `  defect this check exists for. A necessary \`??\` must stay unreported.\n`,
    );
    process.exit(2);
  }

  if (asConfigured.length !== 1) {
    // Which blocks actually reached the probe. A type-aware rule that lands
    // without `parserOptions.project` is reading an inferred program with
    // DEFAULT compiler options, which is the shape of this failure.
    let resolved = '(unavailable)';
    try {
      const cfg = await new ESLint({ cwd: REPO_ROOT }).calculateConfigForFile(
        probe,
      );
      resolved = JSON.stringify({
        project: cfg.parserOptions?.project,
        tsconfigRootDir: cfg.parserOptions?.tsconfigRootDir,
        parser: cfg.parser,
        rule: cfg.rules?.[RULE],
      });
    } catch (error) {
      resolved = `(threw: ${error.message})`;
    }
    console.error(`\n  Resolved config for the probe: ${resolved}`);
    console.error(
      `\n✗ Self-test failed: .eslintrc.js does not apply ${RULE} to a new file\n` +
        `  under src/ (${asConfigured.length} finding(s), expected 1).\n` +
        `${listed(asConfigured)}\n\n` +
        `  The rule sees the defect, so the scope is what broke. Most likely a\n` +
        `  second overrides block declares the rule: a block REPLACES a rule's\n` +
        `  config rather than merging it, so the later one silently wins.\n`,
    );
    process.exit(2);
  }

  console.log(
    '✓ Self-test passed: a function read without calling it is reported, a\n' +
      '  `??` on a genuinely optional value is not, and .eslintrc.js applies the\n' +
      '  rule to a new file under src/.',
  );
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

const results = await lintAll().lintFiles(SCAN_GLOBS);
const scanned = results.filter(
  r => !SKIP.some(re => re.test(relative(REPO_ROOT, r.filePath))),
);

requireNonEmptyScan({
  count: scanned.length,
  what: 'source files',
  check: 'check-unnecessary-condition',
  hint: 'src/ moved, or the glob no longer matches',
  minimum: 800,
});

const { counts, detail } = tally(results);

if (flags.list) {
  const byId = {};
  for (const d of detail) (byId[d.id] ??= []).push(d);
  for (const [id, hits] of Object.entries(byId).sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`\n${id} — ${hits.length}`);
    for (const h of hits) console.log(`      ${h.rel}:${h.line}`);
  }
  process.exit(0);
}

if (flags.update) {
  const recorded = BASELINE.exists() ? BASELINE.read().counts ?? {} : {};
  refuseEmptyBaselineUpdate({
    count: Object.keys(counts).length,
    baselineCount: Object.keys(recorded).length,
    check: 'check-unnecessary-condition',
  });
  BASELINE.write({ counts, scannedFiles: scanned.length });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(
    `Recorded ${total} finding(s) across ${
      Object.keys(counts).length
    } file(s).`,
  );
  process.exit(0);
}

const recorded = BASELINE.require().counts ?? {};

const grew = Object.entries(counts).filter(
  ([rel, n]) => n > (recorded[rel] ?? 0),
);
const { removed } = diffSets(Object.keys(counts), Object.keys(recorded));

if (grew.length) {
  console.error(
    `\n✗ check-unnecessary-condition: ${grew.length} file(s) gained a ` +
      `condition their types say cannot matter.\n`,
  );
  for (const [rel, n] of grew) {
    console.error(`    ${rel}  (${recorded[rel] ?? 0} → ${n})`);
    for (const d of detail.filter(x => x.rel === rel)) {
      console.error(`        ${d.id.padEnd(30)} line ${d.line}`);
    }
  }
  console.error(
    '\n  Either the branch is dead — delete it — or a type over-promises, in\n' +
      '  which case widen it where it is declared, never with a cast. A guard\n' +
      '  against a runtime shape the schema does not model is neither: leave it\n' +
      '  and record the file with --update, saying why in the commit.\n',
  );
  process.exit(1);
}

if (removed.length) {
  console.error(
    `\n✗ check-unnecessary-condition: ${removed.length} baselined file(s) are ` +
      `clean now.\n`,
  );
  for (const rel of removed) console.error(`    ${rel}`);
  console.error(
    '\n  Record it: node scripts/check-unnecessary-condition.mjs --update\n' +
      '  A file leaving the baseline also leaves the excludedFiles list in\n' +
      '  .eslintrc.js, which reads the same file — so lint starts holding it.\n',
  );
  process.exit(1);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
const recordedTotal = Object.values(recorded).reduce((a, b) => a + b, 0);
console.log(
  `check-unnecessary-condition: ${total} finding(s) across ` +
    `${Object.keys(counts).length} files, baseline ${recordedTotal}.`,
);
