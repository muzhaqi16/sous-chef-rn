#!/usr/bin/env node
/**
 * Fails when a comment block runs longer than six lines, when a file carries
 * more comment lines than half its code, or when a comment narrates history
 * instead of describing current behaviour.
 *
 * ## Why a check
 * The house style had drifted to essayistic docblocks: 20-50 lines of prose
 * arguing a design decision, recording what was tried and citing benchmark
 * tables, on top of two or three lines of code. Production `src/` was 17.7% of
 * non-blank lines, 97 files carried more comment than code, and 43% of all
 * comment lines sat in blocks of eight or more. Long blocks also rot fastest —
 * a sweep confirmed 31 wrong comments, including one that described the exact
 * bug the fix beneath it had removed, and three citing docs that do not exist.
 *
 * A comment earns its place when the code cannot say it: a library gotcha, an
 * invariant a future edit would break, a deliberate-looking-wrong note. That
 * fits in one to three lines. Rationale belongs in the PR or `docs/`, and what
 * the code USED to do belongs in git.
 *
 * The history rule lives here rather than in ESLint's `no-warning-comments`
 * because that rule has no baseline, and the ~50 test files still carrying the
 * vocabulary would fail `lint` outright. Production `src/` is clean, so the
 * rule can move to ESLint once tests are too.
 *
 * ## What counts
 * A run of consecutive whole-line comments — `//`, `/* … *\/`, or a JSX
 * `{/* … *\/}` node — with no code and no blank line between them. Length is
 * the line count of that run.
 *
 * ## What is deliberately NOT a rule
 * - Trailing comments on a code line. They are bounded by the code beside them.
 * - The ratio, on files under MIN_CODE_LINES_FOR_RATIO lines of code. On a
 *   35-line module, two 6-line docblocks over two exported functions is 0.5 and
 *   entirely reasonable; on a 565-line one it is 280 lines of prose. Measured
 *   across the tree, a 60-line floor flags 64 files — the substantial offenders
 *   (`cacheUpdaters` 364/565, `wsLink` 302/372) — where a 20-line floor flags
 *   172 and buries them. Small files are the block rule's job.
 * - Tests, mocks and generated files. Test comments explain why a case exists,
 *   and generated files are not hand-edited.
 * - Content, beyond the history vocabulary below. This counts lines; it cannot
 *   tell a load-bearing invariant from a war story. Judgement stays with the
 *   author.
 * - Loose history words that are usually ordinary prose. `prior to`, `legacy`
 *   and a bare `the old` describe live things often enough that banning them
 *   would cost more rewording than it buys.
 *
 * A blank line splits a run, so a long rationale cannot be smuggled past this by
 * spacing it out — that reads as separate notes, which is the point.
 *
 * The baseline is EMPTY, which makes it an invariant rather than a worklist: no
 * file is exempt, and a new entry is a regression to fix rather than a tally to
 * accept. `--update` deliberately refuses to write an empty baseline over a
 * non-empty one, so reaching zero is a one-time deliberate edit.
 *
 *   node scripts/check-comment-budget.mjs             # check
 *   node scripts/check-comment-budget.mjs --list      # print every finding
 *   node scripts/check-comment-budget.mjs --update    # re-baseline
 *   node scripts/check-comment-budget.mjs --self-test # prove the classifier bites
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

const CHECK = 'check-comment-budget';
const BASELINE = baselineFile(
  fromRoot('scripts/check-comment-budget.baseline.json'),
);

const MAX_BLOCK_LINES = 6;

/**
 * Vocabulary that only appears when a comment is describing a past state. Kept
 * narrow on purpose — every term here is one whose sentence cannot be about the
 * code as it stands.
 */
const HISTORY_TERMS = [
  'previously',
  'used to',
  'old behavior',
  'old behaviour',
  'was tried',
  'we tried',
  'regressed',
  'historically',
  'formerly',
  'no longer',
  'this replaces',
  'changed from',
  'until recently',
];
const HISTORY_RE = new RegExp(HISTORY_TERMS.join('|'), 'i');
const MAX_COMMENT_RATIO = 0.5;
const MIN_CODE_LINES_FOR_RATIO = 60;

const SKIP = [
  /(^|\/)__tests__(\/|$)/,
  /(^|\/)__mocks__(\/|$)/,
  /(^|\/)__perf__(\/|$)/,
  /(^|\/)generated(\/|$)/,
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
];

/**
 * Classify each line as comment, code or blank, and group consecutive comment
 * lines into runs. Only a line that STARTS a comment counts; a trailing comment
 * leaves its line classified as code.
 */
export function analyze(source) {
  const lines = source.split('\n');
  const blocks = [];
  let inBlockComment = false;
  let run = 0;
  let runStart = 0;
  let code = 0;
  let comment = 0;

  const historyHits = [];
  const endRun = () => {
    if (run > 0) blocks.push({ start: runStart, length: run });
    run = 0;
  };

  lines.forEach((raw, index) => {
    const text = raw.trim();
    let isComment = false;

    if (inBlockComment) {
      isComment = true;
      if (text.includes('*/')) inBlockComment = false;
    } else if (text === '') {
      endRun();
      return;
    } else if (text.startsWith('//')) {
      isComment = true;
    } else if (text.startsWith('/*') || text.startsWith('{/*')) {
      // `{/* … */}` is a JSX comment node. It renders nothing, so it is a
      // comment for every purpose here — and being brace-prefixed it was
      // invisible to an earlier version of this scan, which let two five-line
      // history blocks sit in `Header` and `CollapsingHeroDetail` unflagged.
      isComment = true;
      if (!text.includes('*/')) inBlockComment = true;
    }

    if (isComment) {
      if (run === 0) runStart = index + 1;
      run += 1;
      comment += 1;
      if (HISTORY_RE.test(text)) historyHits.push(index + 1);
    } else {
      endRun();
      code += 1;
      // Block length ignores trailing comments (they are bounded by the code
      // beside them), but narration in one is still narration.
      const trailing = /\s\/\/(.*)$/.exec(raw);
      if (trailing && HISTORY_RE.test(trailing[1])) historyHits.push(index + 1);
    }
  });
  endRun();

  return { blocks, code, comment, historyHits };
}

/** Every budget violation in one file, as stable path-keyed findings. */
function findingsFor(rel, source) {
  const { blocks, code, comment, historyHits } = analyze(source);
  const found = [];

  const longest = blocks.reduce((max, b) => Math.max(max, b.length), 0);
  if (longest > MAX_BLOCK_LINES) found.push(`${rel}#block`);

  if (code >= MIN_CODE_LINES_FOR_RATIO && comment > code * MAX_COMMENT_RATIO) {
    found.push(`${rel}#ratio`);
  }

  if (historyHits.length) found.push(`${rel}#history`);

  return { found, blocks, code, comment, longest, historyHits };
}

function selfTest() {
  const cases = [
    {
      name: 'a seven-line run is flagged',
      source: [
        '// 1',
        '// 2',
        '// 3',
        '// 4',
        '// 5',
        '// 6',
        '// 7',
        'const a = 1;',
      ].join('\n'),
      expectBlock: true,
    },
    {
      name: 'a six-line run is within budget',
      source: [
        '// 1',
        '// 2',
        '// 3',
        '// 4',
        '// 5',
        '// 6',
        'const a = 1;',
      ].join('\n'),
      expectBlock: false,
    },
    {
      name: 'a long JSDoc is flagged',
      source: [
        '/**',
        ' * 1',
        ' * 2',
        ' * 3',
        ' * 4',
        ' * 5',
        ' * 6',
        ' */',
        'const a = 1;',
      ].join('\n'),
      expectBlock: true,
    },
    {
      name: 'a blank line splits a run',
      source: [
        '// 1',
        '// 2',
        '// 3',
        '',
        '// 4',
        '// 5',
        '// 6',
        'const a = 1;',
      ].join('\n'),
      expectBlock: false,
    },
    {
      name: 'trailing comments are not a run',
      source: Array.from(
        { length: 9 },
        (_, i) => `const a${i} = 1; // note`,
      ).join('\n'),
      expectBlock: false,
    },
    {
      name: "a line-1 'use no memo' directive is code, not a comment",
      source: ["'use no memo';", 'const a = 1;'].join('\n'),
      expectBlock: false,
      expectComment: 0,
    },
    {
      name: 'a JSX comment node is a comment',
      source: [
        '{/* 1',
        '  2',
        '  3',
        '  4',
        '  5',
        '  6',
        '  7 */}',
        '<View />',
      ].join('\n'),
      expectBlock: true,
    },
    {
      name: 'history inside a JSX comment node is flagged',
      source: ['{/* it used to live on the tab headers */}', '<View />'].join(
        '\n',
      ),
      expectBlock: false,
      expectHistory: true,
    },
    {
      name: 'history narration is flagged',
      source: [
        '// This used to re-declare both paddings.',
        'const a = 1;',
      ].join('\n'),
      expectBlock: false,
      expectHistory: true,
    },
    {
      name: 'present-tense prose is not flagged',
      source: ['// Cleared as null, never removed.', 'const a = 1;'].join('\n'),
      expectBlock: false,
      expectHistory: false,
    },
    {
      name: 'history in a trailing comment is flagged',
      source: ['const a = 1; // previously 250ms'].join('\n'),
      expectBlock: false,
      expectHistory: true,
    },
    {
      name: 'a url in code is not read as a trailing comment',
      source: ["const u = 'https://example.com/previously';"].join('\n'),
      expectBlock: false,
      expectHistory: false,
    },
  ];

  let failed = 0;
  for (const testCase of cases) {
    const { blocks, comment, historyHits } = findingsFor(
      'probe.ts',
      testCase.source,
    );
    const flagged = blocks.some(b => b.length > MAX_BLOCK_LINES);
    const history = historyHits.length > 0;
    if (flagged !== testCase.expectBlock) {
      console.error(
        `  ✗ ${testCase.name}: expected flagged=${testCase.expectBlock}, got ${flagged}`,
      );
      failed += 1;
    } else if (
      testCase.expectComment !== undefined &&
      comment !== testCase.expectComment
    ) {
      console.error(
        `  ✗ ${testCase.name}: expected ${testCase.expectComment} comment lines, got ${comment}`,
      );
      failed += 1;
    } else if (
      testCase.expectHistory !== undefined &&
      history !== testCase.expectHistory
    ) {
      console.error(
        `  ✗ ${testCase.name}: expected history=${testCase.expectHistory}, got ${history}`,
      );
      failed += 1;
    } else {
      console.log(`  ✓ ${testCase.name}`);
    }
  }

  if (failed) {
    console.error(`\n✗ ${CHECK} --self-test: ${failed} case(s) failed.\n`);
    process.exit(2);
  }
  console.log(`\n✓ ${CHECK} --self-test: ${cases.length} case(s) passed.`);
  process.exit(0);
}

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
  'self-test': { type: 'boolean', default: false },
});

if (flags['self-test']) selfTest();

const files = filesUnder(['src/**/*.ts', 'src/**/*.tsx'], { exclude: SKIP });

requireNonEmptyScan({
  count: files.length,
  what: 'source files',
  check: CHECK,
  hint: 'src/**/*.{ts,tsx} no longer matches — did the exclude patterns widen?',
  minimum: 200,
});

const current = [];
const detail = [];

for (const file of files) {
  const rel = relative(REPO_ROOT, file);
  const { found, blocks, code, comment, longest, historyHits } = findingsFor(
    rel,
    readFileSync(file, 'utf8'),
  );
  if (!found.length) continue;
  current.push(...found);
  detail.push({ rel, blocks, code, comment, longest, historyHits });
}

current.sort();

if (flags.list) {
  for (const entry of detail) {
    const over = entry.blocks.filter(b => b.length > MAX_BLOCK_LINES);
    const ratio = entry.code ? (entry.comment / entry.code).toFixed(2) : 'n/a';
    console.log(
      `  ${entry.rel}  (${entry.comment} cmt / ${entry.code} code, ratio ${ratio})`,
    );
    for (const block of over) {
      console.log(`      line ${block.start}: ${block.length}-line block`);
    }
    for (const line of entry.historyHits) {
      console.log(`      line ${line}: history narration`);
    }
  }
  console.log(`\n${current.length} finding(s) across ${files.length} files.`);
  process.exit(0);
}

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: (BASELINE.read()?.findings ?? []).length,
    check: CHECK,
  });
  BASELINE.write({ findings: current, scannedFiles: files.length });
  console.log(
    `Recorded ${current.length} finding(s) from ${files.length} scanned.`,
  );
  process.exit(0);
}

const baseline = BASELINE.require(CHECK);
const recorded = baseline.findings ?? [];
const { added, removed } = diffSets(current, recorded);

if (added.length) {
  console.error(`\n✗ ${CHECK}: ${added.length} new finding(s).\n`);
  for (const finding of added) console.error(`    ${finding}`);
  console.error(
    `\n  '#block' is a comment run longer than ${MAX_BLOCK_LINES} lines; '#ratio' is a file whose\n` +
      `  comments exceed ${
        MAX_COMMENT_RATIO * 100
      }% of its code; '#history' is a comment narrating what\n` +
      `  the code used to do. Say the constraint the code cannot say — a library\n` +
      `  gotcha, an invariant an edit would break — in one to three lines, in the\n` +
      `  present tense. Rationale and evidence go in the PR or docs/; history is\n` +
      `  already in git. Run with --list to see the offending lines.\n`,
  );
  process.exit(1);
}

console.log(
  `${CHECK}: ${current.length} finding(s) across ${files.length} files, ` +
    `baseline ${recorded.length}` +
    (removed.length ? ` (${removed.length} cleared — run --update)` : '') +
    '.',
);
