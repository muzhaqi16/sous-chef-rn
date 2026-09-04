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
 * Absolute, sorted paths for one or more globs. `exclude` takes REGEXES, matched
 * against a MIX of bare directory names, basenames and repo-relative paths: each
 * must be a path-segment (`(^|\/)generated(\/|$)`) or suffix (`\.test\.tsx$`)
 * pattern. The array form of `exclude` is Node 24+, and CI runs Node 22.
 */
export function filesUnder(patterns, { exclude = [], cwd = REPO_ROOT } = {}) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  const skip = p => exclude.some(re => re.test(p));

  // `globSync`'s own `exclude` is called on DIRECTORIES, for pruning — it never
  // sees a matched file. So a pattern naming a file (`\.test\.tsx$`, one
  // module by path) prunes nothing there, and the same list is applied again to
  // the results. Passing it to the glob as well keeps the directory pruning.
  return [
    ...new Set(
      list.flatMap(pattern => globSync(pattern, { cwd, exclude: skip })),
    ),
  ]
    .filter(f => !skip(f))
    .map(f => join(cwd, f))
    .sort();
}

/**
 * The property that makes a scanning check a guard rather than decoration: a
 * scan broken into finding NOTHING prints exactly what a clean tree prints, and
 * a baselined check then reports an improvement and offers to write the empty
 * result over the record. `minimum` is the floor below which it is not credible.
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
 * Refuse to re-baseline from a scan that found nothing: a broken check finds
 * zero, reports an improvement, and tells you to run `--update`, writing the
 * empty result over the record. The second lock after `requireNonEmptyScan`,
 * for a check whose update path can be reached without a full scan.
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
 * Baseline plumbing. Only the plumbing is shared — what a baseline MEANS differs
 * per check, and each keeps its own comparison.
 *
 * No file means the rule is an INVARIANT: deleting it IS the promotion.
 */
export function baselineFile(path) {
  return {
    path,
    exists: () => existsSync(path),
    read: () =>
      existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined,
    /**
     * The recorded baseline, or an empty one when there is no file — see the
     * note above: absent means the rule is an invariant, not that it is
     * unconfigured.
     */
    require() {
      return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    },
    write(data) {
      if (!existsSync(path)) {
        console.error(
          `\n✗ No baseline at ${path}, so this rule is an INVARIANT.\n\n` +
            `  Writing one would hand it back the exemptions it was promoted\n` +
            `  out of. Fix the finding instead. If the rule genuinely has to\n` +
            `  become a ratchet again, restore the file in its own commit and\n` +
            `  say why.\n`,
        );
        process.exit(2);
      }
      writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
    },
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
 * `strict` makes a valueless flag an error rather than an absent one — for a
 * gate, checking the wrong thing instead of failing. The throw becomes exit 2,
 * "this check is broken", as distinct from 1, "this check found a problem".
 */
export function parseFlags(options) {
  try {
    return parseArgs({ options, strict: true }).values;
  } catch (error) {
    console.error(`\n✗ ${error.message}\n`);
    process.exit(2);
  }
}

/**
 * Fail unless `babel.config.js` runs Unistyles → scope-crawl → compiler in that
 * order: `check-unistyles-variant-staleness` rebuilds that pipeline, and this is
 * what ties it to the real config. Read as TEXT — executing the config needs an
 * `api` stub, and `api.env()` differs per branch, so a stub changes the answer.
 */
export function assertMatchesBabelConfig() {
  const config = readFileSync(fromRoot('babel.config.js'), 'utf8');
  const ORDER = [
    'react-native-unistyles/plugin',
    './scripts/babel/unistyles-scope-crawl.js',
    'babel-plugin-react-compiler',
  ];

  const positions = ORDER.map(name => ({
    name,
    at: config.indexOf(`'${name}'`),
  }));
  const missing = positions.filter(p => p.at === -1);
  const outOfOrder = positions.some(
    (p, i) => i > 0 && p.at < positions[i - 1].at,
  );

  if (missing.length || outOfOrder) {
    console.error(
      `\n✗ babel.config.js no longer declares the expected plugin order.\n\n` +
        `  Expected, in this order:\n` +
        ORDER.map(n => `    ${n}`).join('\n') +
        (missing.length
          ? `\n\n  Not found: ${missing.map(m => m.name).join(', ')}`
          : '\n\n  Found, but out of order.') +
        `\n\n  The checks that rebuild this pipeline are now measuring something\n` +
        `  the app is not compiled with. Reconcile them before trusting either.\n`,
    );
    process.exit(2);
  }
}
