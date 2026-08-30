/**
 * Module aliases, derived from `tsconfig.json`.
 *
 * `tsconfig.json` is the single source. It already feeds TypeScript directly and
 * ESLint through `import/resolver.typescript`, so deriving Babel's and Jest's
 * copies from it means one list instead of three.
 *
 * There were three, with three different matching semantics: tsconfig had 32
 * entries in bare + `/*` pairs, Babel had 25 relying on module-resolver's prefix
 * behaviour for the ones it omitted, and Jest had 19 suffix-capture regexes.
 * `#/test-utils` was spelled differently in each. Nothing checked them against
 * one another, so an alias added to tsconfig simply did not resolve at runtime
 * or in tests until someone noticed.
 *
 * CommonJS on purpose: `babel.config.js` and `jest.config.js` are both CJS and
 * load before any transform runs.
 */
const { compilerOptions } = require('../../tsconfig.json');

/** `{ '#components': './src/components', ... }` — bare prefixes, no globs. */
const prefixes = () => {
  const out = {};
  for (const [pattern, [target]] of Object.entries(compilerOptions.paths)) {
    const key = pattern.replace(/\/?\*$/, '');
    const value = target.replace(/\/?\*$/, '');
    // A bare entry and its `/*` twin collapse to the same prefix; identical
    // targets, so last-write-wins is safe.
    out[key === '#' ? '#' : key] = value;
  }
  return out;
};

/**
 * Longest key first.
 *
 * `#/test-utils` must be tried before `#/`, and `#components` before `#`.
 * tsconfig resolves by specificity regardless of order; Babel's module-resolver
 * and Jest's `moduleNameMapper` both take the FIRST match, so the ordering is
 * load-bearing for them and not for tsconfig.
 */
const bySpecificity = entries =>
  entries.sort(([a], [b]) => b.length - a.length);

/** Aliases for `babel-plugin-module-resolver`. */
const babelAliases = () =>
  Object.fromEntries(bySpecificity(Object.entries(prefixes())));

/** `moduleNameMapper` entries for Jest, rooted at `<rootDir>`. */
const jestModuleNameMapper = () =>
  Object.fromEntries(
    bySpecificity(Object.entries(prefixes())).map(([alias, target]) => [
      `^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.*)$`,
      `<rootDir>/${target.replace(/^\.\//, '')}$1`,
    ]),
  );

/**
 * `[['#components/', 'src/components/'], …]`, longest alias first — the shape a
 * plain prefix-replacing script wants.
 *
 * `check-dead-modules.mjs` hand-maintained a FOURTH copy of this list, which had
 * already drifted from `tsconfig.json` in both directions. A module reached only
 * through a missing alias reads as unreferenced, and one reached through a stale
 * alias reads as referenced; both are wrong, and neither is visible.
 */
const prefixPairs = () =>
  bySpecificity(Object.entries(prefixes())).map(([alias, target]) => [
    alias === '#' ? '#/' : `${alias}/`,
    `${target.replace(/^\.\//, '')}/`,
  ]);

module.exports = { babelAliases, jestModuleNameMapper, prefixPairs };
