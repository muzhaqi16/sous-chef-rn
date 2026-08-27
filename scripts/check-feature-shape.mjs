#!/usr/bin/env node
/**
 * Fails when a feature under `src/features/` does not have the shape every
 * other feature has.
 *
 * ## Why a check
 *
 * A feature is meant to be liftable — into a sibling app, into a package, or
 * out of this one entirely. That only works if every feature keeps its parts in
 * the same places, so a consumer can find them without reading the feature.
 * Today they do not: `profile` has eleven screens and no `components/` at all
 * (its UI lives in `src/components/organisms/ProfileInfo/`), `home` and
 * `barcode` scatter `.graphql` beside components instead of in `graphql/`, two
 * features have no `screens/registration.ts`, and contexts live in three
 * different folders depending on the feature.
 *
 * None of that is wrong on its own. All of it together is why "delete the
 * folder and remove its registry entry" does not currently work.
 *
 * ## Rules
 *
 *   manifest        `manifest.ts` exists and its `id` equals the directory name
 *   screens         a `screens/` directory exists
 *   hooks           a `hooks/` directory exists
 *   components      a `components/` directory exists
 *   registration    a feature with detail screens declares `screens/registration.ts`
 *
 * ## What is deliberately NOT a rule
 *
 * A `.graphql` document sitting beside the component or hook that owns it is
 * the repo's convention, not a deviation — `CLAUDE.md` § Fragments requires it
 * (`<Consumer>_<entity>` in a sibling file), and `graphql/` holds only the
 * shared `*Fragments.graphql`. A check that flagged colocation would fail 5 of
 * 8 features for following the documented rule.
 *
 * Likewise a React context colocated with the component it serves
 * (`SortableShoppingList/SortableListThemeContext.tsx`). `context/` is where a
 * feature-WIDE context goes; a context scoped to one subtree belongs with it.
 *
 * The baseline is EMPTY, which makes this an invariant rather than a backlog:
 * every feature has the same shape, so any deviation is a regression. It got
 * there from 3 — `profile` gained the `components/` its UI had been living
 * outside of, and `barcode`/`notifications` took ownership of the screen lists
 * their stacks had been declaring for them.
 *
 *   node scripts/check-feature-shape.mjs           # check
 *   node scripts/check-feature-shape.mjs --list    # print every deviation
 *   node scripts/check-feature-shape.mjs --update  # re-baseline
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

import {
  baselineFile,
  diffSets,
  filesUnder,
  fromRoot,
  parseFlags,
  refuseEmptyBaselineUpdate,
  requireNonEmptyScan,
} from './lib/tooling.mjs';

const BASELINE = baselineFile(
  fromRoot('scripts/check-feature-shape.baseline.json'),
);

const FEATURES_DIR = fromRoot('src/features');

const featureDirs = filesUnder('src/features/*/manifest.ts')
  .map(f => f.split(sep).at(-2))
  .sort();

requireNonEmptyScan({
  count: featureDirs.length,
  what: 'features',
  check: 'check-feature-shape',
  hint: 'src/features/*/manifest.ts no longer matches — was the manifest renamed?',
  minimum: 4,
});

const flags = parseFlags({
  list: { type: 'boolean', default: false },
  update: { type: 'boolean', default: false },
});

/** `id: 'pantry'` out of a manifest, without executing TypeScript. */
const declaredId = source => source.match(/\bid:\s*'([^']+)'/)?.[1];

const deviations = [];
const note = (feature, rule, detail) =>
  deviations.push(`${feature}: ${rule}${detail ? ` — ${detail}` : ''}`);

for (const feature of featureDirs) {
  const root = join(FEATURES_DIR, feature);
  const has = child => existsSync(join(root, child));

  const manifest = readFileSync(join(root, 'manifest.ts'), 'utf8');
  const id = declaredId(manifest);
  if (id !== feature) {
    note(
      feature,
      'manifest',
      `declares id '${id ?? '?'}', directory is '${feature}'`,
    );
  }

  if (!has('screens')) note(feature, 'screens', 'no screens/ directory');
  if (!has('hooks')) note(feature, 'hooks', 'no hooks/ directory');
  if (!has('components'))
    note(feature, 'components', 'no components/ directory');

  const screens = filesUnder(`src/features/${feature}/screens/*.tsx`);
  if (screens.length > 1 && !has(join('screens', 'registration.ts'))) {
    note(
      feature,
      'registration',
      `${screens.length} screens, no screens/registration.ts`,
    );
  }
}

const current = deviations.sort();
const recorded = BASELINE.exists() ? BASELINE.read().deviations ?? [] : [];

if (flags.list) {
  for (const d of current) console.log(`  ${d}`);
  console.log(
    `\n${current.length} deviation(s) across ${featureDirs.length} features.`,
  );
  process.exit(0);
}

if (flags.update) {
  refuseEmptyBaselineUpdate({
    count: current.length,
    baselineCount: recorded.length,
    check: 'check-feature-shape',
  });
  BASELINE.write({ deviations: current, features: featureDirs });
  console.log(
    `Recorded ${current.length} deviation(s) across ${featureDirs.length} features.`,
  );
  process.exit(0);
}

const baseline = BASELINE.require('check-feature-shape');
const { added, removed } = diffSets(current, baseline.deviations ?? []);

if (added.length) {
  console.error(`\n✗ check-feature-shape: ${added.length} new deviation(s).\n`);
  for (const d of added) console.error(`    ${d}`);
  console.error(
    `\n  Every feature keeps its parts in the same places so a consumer can\n` +
      `  find them without reading the feature, and so the feature can be\n` +
      `  lifted out. See docs/architecture.md § The public API boundary.\n`,
  );
  process.exit(1);
}

console.log(
  `check-feature-shape: ${current.length} deviation(s) across ${featureDirs.length} ` +
    `features, baseline ${baseline.deviations.length}` +
    (removed.length ? ` (${removed.length} cleared — run --update)` : '') +
    '.',
);
