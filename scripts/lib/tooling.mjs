/**
 * Shared plumbing for the checks in `scripts/`.
 *
 * Builtins only, deliberately: `check-i18n`, `audit-fragment-inlining` and
 * `check-bundled-secrets` run in CI jobs that skip `npm ci`, so anything they
 * reach must resolve with no install.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export const fromRoot = (...segments) => join(REPO_ROOT, ...segments);

/**
 * Absolute, sorted paths for one or more globs.
 *
 * `exclude` takes regexes, not glob patterns, and they are matched against
 * whatever `globSync` hands the predicate — which is a MIX: bare directory
 * names, bare file basenames, and repo-relative paths. So an exclude must be
 * either a path-segment pattern (`(^|\/)generated(\/|$)`) or a suffix
 * (`\.test\.tsx$`). A regex anchored on a full relative path silently matches
 * nothing, because the predicate never sees one for a file. Exclude a single
 * known file by filtering the returned absolute paths instead.
 *
 * The array form of `exclude` is Node 24+, and CI runs Node 22.
 *
 * Sorted because `globSync` is not, and several callers print their results.
 *
 * @param {string|string[]} patterns
 * @param {{exclude?: RegExp[], cwd?: string}} [options]
 * @returns {string[]}
 */
export function filesUnder(patterns, { exclude = [], cwd = REPO_ROOT } = {}) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  const skip = p => exclude.some(re => re.test(p));

  return [
    ...new Set(
      list.flatMap(pattern => globSync(pattern, { cwd, exclude: skip })),
    ),
  ]
    .map(f => join(cwd, f))
    .sort();
}

/**
 * The property that makes a scanning check a guard rather than decoration.
 *
 * Every check here that derives its inputs by scanning — files, symbols, call
 * sites, compiled output — can be broken into finding NOTHING by a change it
 * does not control: a preset upgrade that alters the compiled shape it
 * pattern-matches, a rename, a moved directory, a `cwd` it did not expect.
 * When that happens the check prints its success line and exits 0, which is
 * indistinguishable from the check not existing at all. Worse, a check with a
 * recorded baseline then reports an improvement, and offers to re-baseline the
 * empty result — erasing the record of everything it used to catch.
 *
 * @param {object} options
 * @param {number} options.count     How many candidates the scan produced.
 * @param {string} options.what      Plural noun for the candidates.
 * @param {string} options.check     The script's name, for the message.
 * @param {string} [options.hint]    What usually breaks this scan.
 * @param {number} [options.minimum] Floor below which the scan is not credible.
 *                                   Pass a recorded baseline's size where a
 *                                   sudden collapse is the signal.
 */
export function requireNonEmptyScan({ count, what, check, hint, minimum = 1 }) {
  if (count >= minimum && count > 0) return;

  console.error(
    `\n✗ ${check} found ${count} ${what} to examine (expected at least ` +
      `${minimum}).\n\n` +
      `  An empty or collapsed candidate set is a FAILURE of this check, not a\n` +
      `  pass. A scan that matched nothing reports exactly what a clean tree\n` +
      `  reports, so this exits non-zero instead of claiming the tree is clean.\n` +
      (hint ? `\n  Most likely: ${hint}\n` : ''),
  );
  process.exit(2);
}

/**
 * Refuse to re-baseline from a scan that found nothing.
 *
 * The dangerous pairing: a check breaks, finds zero, reports an improvement
 * against its baseline, and tells you to run `--update`. That writes the empty
 * result over the record. `requireNonEmptyScan` already fails the run, so this
 * is the second lock — for a check whose update path can be reached without a
 * full scan.
 */
export function refuseEmptyBaselineUpdate({ count, baselineCount, check }) {
  if (count > 0 || baselineCount === 0) return;

  console.error(
    `\n✗ ${check} will not write an empty baseline over a non-empty one ` +
      `(${baselineCount} recorded).\n\n` +
      `  Finding zero after recording ${baselineCount} is far more likely to be\n` +
      `  a broken scan than a fixed codebase. Confirm the scan still matches\n` +
      `  before re-baselining.\n`,
  );
  process.exit(2);
}

/**
 * Load/write plumbing for a recorded baseline.
 *
 * Only the plumbing is shared. What a baseline MEANS differs per check — a set,
 * a numeric cap, a per-key counter map — and each keeps its own comparison.
 *
 * @param {string} path Absolute path to the baseline JSON.
 */
export function baselineFile(path) {
  return {
    path,
    exists: () => existsSync(path),
    read: () =>
      existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined,
    /** Exit 2 with one message when the record a ratchet needs is absent. */
    require(check) {
      if (!existsSync(path)) {
        console.error(
          `\n✗ ${check}: no baseline at ${path}.\n\n` +
            `  Run with --update to record one.\n`,
        );
        process.exit(2);
      }
      return JSON.parse(readFileSync(path, 'utf8'));
    },
    write: data => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`),
  };
}

/** What a set-membership ratchet needs: what appeared, and what went away. */
export function diffSets(current, baseline) {
  const known = new Set(baseline);
  const present = new Set(current);
  return {
    added: current.filter(x => !known.has(x)),
    removed: baseline.filter(x => !present.has(x)),
  };
}

/**
 * Capture a subprocess's stdout. The measurement scripts drive `xcrun simctl`
 * and read its output; `stdio: 'pipe'` keeps a non-zero exit throwing rather
 * than leaking the tool's stderr into a captured timeline.
 */
export const sh = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...options });

/** Median, not mean: startup samples have outliers that a mean hides. */
export const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * `parseArgs` with the exit code these scripts use for "invoked wrongly".
 *
 * `strict` is what makes a valueless flag an error rather than an absent one,
 * which for a gate means checking the wrong thing instead of failing. The
 * throw becomes exit 2 — the code the checks use for "this check is broken",
 * as distinct from 1, "this check found a problem".
 */
export function parseFlags(options) {
  try {
    return parseArgs({ options, strict: true }).values;
  } catch (error) {
    console.error(`\n✗ ${error.message}\n`);
    process.exit(2);
  }
}
