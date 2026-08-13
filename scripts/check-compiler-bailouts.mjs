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
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from 'fs';
import { join, extname } from 'path';

const SRC = 'src';
const BASELINE = 'scripts/check-compiler-bailouts.baseline.json';
const UPDATE = process.argv.includes('--update');
const LIST = process.argv.includes('--list');

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (['__tests__', '__mocks__', 'generated'].includes(entry)) continue;
      sourceFiles(full, out);
    } else if (
      ['.ts', '.tsx'].includes(extname(entry)) &&
      !/\.(test|spec)\.tsx?$/.test(entry) &&
      !/\.generated\.ts$/.test(entry)
    ) {
      out.push(full);
    }
  }
  return out;
}

const files = sourceFiles(SRC);
const failures = [];
let compiled = 0;
let succeeded = 0;

for (const file of files) {
  let sawEvent = false;
  const reasons = [];
  try {
    await babel.transformAsync(readFileSync(file, 'utf8'), {
      filename: file,
      cwd: process.cwd(),
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
  if (sawEvent) compiled++;
  if (reasons.length) failures.push({ file, reasons: [...new Set(reasons)] });
}

// A run that compiled nothing must not look like a clean run. This is the same
// vacuity trap the checks in this change exist to close.
if (compiled === 0) {
  console.error(
    `✗ Compiled 0 of ${files.length} files — the compiler produced no events at all.\n` +
      `  Something is wrong with the setup, not with the code. Not reporting this as clean.`,
  );
  process.exit(2);
}

const count = failures.length;
console.log(
  `Scanned ${files.length} files · ${compiled} reached the compiler · ` +
    `${succeeded} functions compiled · ${count} files with bailouts`,
);

if (LIST || UPDATE) {
  for (const f of failures)
    console.log(`  ${f.file}\n    ${f.reasons.join('; ')}`);
}

if (UPDATE) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      { maxFilesWithBailouts: count, files: failures.map(f => f.file).sort() },
      null,
      2,
    )}\n`,
  );
  console.log(`\nBaseline updated: ${count} files.`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `\n✗ No baseline at ${BASELINE}. Run with --update to record one.`,
  );
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
if (count > baseline.maxFilesWithBailouts) {
  const known = new Set(baseline.files);
  console.error(
    `\n✗ ${count} files bail out, baseline allows ${baseline.maxFilesWithBailouts}.\n` +
      `New since the baseline:`,
  );
  for (const f of failures.filter(x => !known.has(x.file))) {
    console.error(`  ${f.file}\n    ${f.reasons.join('; ')}`);
  }
  console.error(
    `\nThe compiler skipped these, so they are not memoized — and the project's\n` +
      `rules against useMemo/useCallback/React.memo assume it did not skip them.\n` +
      `Extract the variant call into a leaf component, or lower the baseline if\n` +
      `this is a deliberate regression.`,
  );
  process.exit(1);
}

if (count < baseline.maxFilesWithBailouts) {
  console.log(
    `\n✓ ${baseline.maxFilesWithBailouts - count} fewer than baseline. ` +
      `Run with --update to ratchet it down.`,
  );
} else {
  console.log('\n✓ No new bailouts.');
}
