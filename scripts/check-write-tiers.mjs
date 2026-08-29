#!/usr/bin/env node
/**
 * check-write-tiers — the offline guarantee as a reviewable list.
 *
 * Prints every mutation the app sends and the tier it is sent at:
 *
 *   durable      the write survives being made offline — it is applied to the
 *                cache permanently and replayed from the queue
 *   online-only  the write is refused up front while the API is unreachable
 *
 * and FAILS when one operation is sent at both tiers. A tier belongs to the
 * OPERATION, not to the screen that happens to invoke it: two call sites
 * disagreeing means the same action is durable when taken from one screen and
 * refused from another, which nobody can predict and no copy can explain.
 *
 * The tier is read from the call site because that is where it is decided —
 * `context.localFirst` (set by hand, or by the write kit's `apply`/`describe`)
 * is what `queueLink` gates replay on. Anything else is online-only by
 * construction, whether or not it says so.
 */

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { filesUnder, parseFlags, REPO_ROOT } from './lib/tooling.mjs';

const { list } = parseFlags({ list: { type: 'boolean', default: false } });

const DURABLE = 'durable';
const ONLINE_ONLY = 'online-only';
/**
 * The call decides its own tier at runtime — it spreads the replay context in
 * conditionally, so the tier depends on the arguments rather than the site.
 *
 * Reported rather than guessed. Reading such a call as online-only (no literal
 * `context` key) or durable (a context exists somewhere) would both be a lie in
 * half the cases, and this report is the reviewable list of what the app
 * guarantees offline — a wrong row in it is worse than an honest "read the
 * call site".
 */
const CONDITIONAL = 'conditional';

/**
 * Why an operation decides its tier per call. Empty is the healthy state — an
 * entry is a call site the report cannot describe in one word.
 */
const CONDITIONAL_REASONS = new Map();

/**
 * Operations knowingly sent at both tiers, each with the reason.
 *
 * An entry keeps the split VISIBLE — it is still printed in the report — rather
 * than silencing it. Add one only for a difference somebody decided on, and say
 * what it was; anything else is a bug this check exists to find.
 */
const ACCEPTED_SPLITS = new Map([
  [
    'CreatePantryItem',
    'Onboarding stocks the pantry from a chip set that is itself fetched, so ' +
      'that screen cannot be reached offline at all. In-store adds stay durable.',
  ],
  [
    'DeletePantryItem',
    'Same onboarding screen, same reason: its removes undo picks made seconds ' +
      'earlier on a screen that only exists with a connection.',
  ],
]);

/** The span of the object literal starting at `open`, brace-matched. */
function objectAt(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return src.slice(open);
}

/**
 * Every `mutate(...)` invocation of `binding`, as the source of its argument.
 *
 * A mutation is fired through the tuple's first element, so the binding name is
 * the only reliable link between the document and the options carrying the
 * tier. Matching the document name alone would miss it: the two are never
 * adjacent.
 */
function callsOf(src, binding) {
  const calls = [];
  const re = new RegExp(`\\b${binding}\\(\\s*\\{`, 'g');
  for (const m of src.matchAll(re)) {
    calls.push(objectAt(src, m.index + m[0].length - 1));
  }
  return calls;
}

/**
 * Whether the options object spreads something in at its own level.
 *
 * Depth-aware on purpose: `variables: { ...(x && { y }) }` is input assembly and
 * says nothing about replay, while `{ variables, ...replay }` is a call
 * choosing its own tier.
 */
function hasTopLevelSpread(args) {
  let depth = 0;
  for (let i = 0; i < args.length; i += 1) {
    const ch = args[i];
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    else if (
      depth === 1 &&
      ch === '.' &&
      args.slice(i, i + 3) === '...' &&
      /[A-Za-z_$]/.test(args[i + 3] ?? '')
    ) {
      return true;
    }
  }
  return false;
}

const files = filesUnder('src/**/*.{ts,tsx}', {
  exclude: [/__tests__/, /\.generated\.ts$/],
});

/** operation -> tier -> [call sites] */
const tiers = new Map();

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(REPO_ROOT, file);

  for (const m of src.matchAll(
    /(?:const|let)\s*\[\s*([A-Za-z0-9_]+)[^\]]*\]\s*=\s*useMutation\(\s*([A-Za-z0-9_]+)Document/g,
  )) {
    const [, binding, operation] = m;
    const calls = callsOf(src, binding);
    // Declared but never fired here — a hook that only reports `loading`.
    if (calls.length === 0) continue;

    // Any `context` on the call: `queueLink` reads `localFirst` off it, and the
    // only thing that puts a context on a mutate call in this codebase is a
    // replay opt-in — set by hand as `{ localFirst: true }`, or handed over by
    // the write kit, which call sites pass through as shorthand.
    const durable = calls.some(args => /(^|[{,\s])context\s*[,}:]/.test(args));
    // Only a spread at the OPTIONS level says anything about the tier — one
    // inside `variables` is ordinary input assembly.
    const conditional = calls.some(hasTopLevelSpread);
    const tier = durable ? DURABLE : conditional ? CONDITIONAL : ONLINE_ONLY;

    if (!tiers.has(operation)) tiers.set(operation, new Map());
    const byTier = tiers.get(operation);
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier).push(rel);
  }
}

const allSplits = [...tiers]
  .filter(([, byTier]) => byTier.size > 1)
  .sort(([a], [b]) => a.localeCompare(b));
const split = allSplits.filter(
  ([operation]) => !ACCEPTED_SPLITS.has(operation),
);

if (list || split.length === 0) {
  const rows = [...tiers].sort(([a], [b]) => a.localeCompare(b));
  const width = Math.max(...rows.map(([op]) => op.length));
  for (const [operation, byTier] of rows) {
    const only = [...byTier.keys()][0];
    const tier =
      byTier.size > 1
        ? ACCEPTED_SPLITS.has(operation)
          ? 'split (accepted)'
          : 'SPLIT'
        : only === CONDITIONAL
        ? 'conditional (per call)'
        : only;
    console.log(`${operation.padEnd(width)}  ${tier}`);
  }
  const count = tier =>
    rows.filter(([, b]) => b.size === 1 && b.has(tier)).length;
  const durableCount = count(DURABLE);
  const conditionalCount = count(CONDITIONAL);
  console.log(
    `\ncheck-write-tiers: ${rows.length} mutation(s) — ${durableCount} durable offline, ` +
      `${
        rows.length - durableCount - conditionalCount - allSplits.length
      } online-only, ` +
      `${conditionalCount} conditional, ${allSplits.length} split.`,
  );
  for (const [operation, reason] of ACCEPTED_SPLITS) {
    if (tiers.get(operation)?.size > 1) {
      console.log(`\n  ${operation} — accepted split: ${reason}`);
    }
  }
  for (const [operation, byTier] of rows) {
    if (!byTier.has(CONDITIONAL)) continue;
    const reason = CONDITIONAL_REASONS.get(operation);
    console.log(
      `\n  ${operation} — conditional: ${
        reason ?? 'UNDOCUMENTED. Say why at the call site and record it here.'
      }`,
    );
  }
}

if (split.length === 0) process.exit(0);

console.error(
  `\n✗ check-write-tiers: ${split.length} operation(s) sent at BOTH tiers.\n`,
);
for (const [operation, byTier] of split) {
  console.error(`  ${operation}`);
  for (const [tier, sites] of byTier) {
    for (const site of sites) console.error(`    ${tier.padEnd(11)} ${site}`);
  }
}
console.error(
  `
  The same action is durable from one screen and refused from another. Pick the
  operation's tier and make every call site send it that way — the durable path
  is the write kit (\`useWrite().apply\`), the online-only path is an
  \`isApiUnavailable\` guard with localized copy.
`,
);
process.exit(1);
