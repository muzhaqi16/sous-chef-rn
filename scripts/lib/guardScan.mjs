/**
 * The property that makes a scanning check a guard rather than decoration.
 *
 * Every check in this directory that derives its inputs by scanning — files,
 * symbols, call sites, compiled output — can be broken into finding NOTHING by
 * a change it does not control: a preset upgrade that alters the compiled shape
 * it pattern-matches, a rename, a moved directory, a `cwd` it did not expect.
 * When that happens the check prints its success line and exits 0, which is
 * indistinguishable from the check not existing at all. Worse, a check with a
 * recorded baseline then reports an improvement, and offers to re-baseline the
 * empty result — erasing the record of everything it used to catch.
 *
 * `check-bundled-secrets.mjs` already states the rule: "An empty candidate set
 * is a failure of this check, not a pass." This is that rule, extracted so the
 * scripts state it once instead of each remembering to.
 */

/**
 * Exit non-zero unless the scan actually looked at something.
 *
 * @param {object}   options
 * @param {number}   options.count     How many candidates the scan produced.
 * @param {string}   options.what      Plural noun for the candidates ("source files").
 * @param {string}   options.check     The script's name, for the message.
 * @param {string}   [options.hint]    What usually breaks this scan.
 * @param {number}   [options.minimum] Floor below which the scan is not credible.
 *                                     Defaults to 1. Pass a recorded baseline's
 *                                     size where a sudden collapse is the signal.
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
 * result over the record. `requireNonEmptyScan` above already fails the run, so
 * this is the second lock — for a check whose update path can be reached
 * without a full scan.
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
