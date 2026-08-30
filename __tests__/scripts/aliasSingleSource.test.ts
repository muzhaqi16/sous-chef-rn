import fs from 'fs';
import path from 'path';

/**
 * `tsconfig.json` is the single source for module aliases.
 *
 * CLAUDE.md: "Add an alias in ONE place." `babel.config.js` and
 * `jest.config.js` already derive theirs through `scripts/lib/aliases.js`, and
 * ESLint reads tsconfig directly — but `check-dead-modules.mjs` hand-maintained
 * a FOURTH list, and it had already drifted in both directions. A module
 * reached only through a missing alias reads as unreferenced; one reached
 * through a stale alias reads as referenced. Neither is visible from the script.
 *
 * Also: every top-level `src/` folder gets an alias. Five did not — `apollo`,
 * `app` (the composition root the PR introduced), `i18n`, `native` and `theme` —
 * while CLAUDE.md states that every one of them does.
 */

const ROOT = path.join(__dirname, '..', '..');

// The alias derivation is CommonJS on purpose (`babel.config.js` and
// `jest.config.js` are both CJS and load before any transform runs), so it is
// loaded the same way they load it.
const loadAliases = (): { prefixPairs: () => [string, string][] } =>
  jest.requireActual(path.join(ROOT, 'scripts/lib/aliases.js'));
const { prefixPairs } = loadAliases();

const tsconfigPaths = (): Record<string, string[]> => {
  const raw = fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf8');
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '')).compilerOptions.paths;
};

describe('module aliases have one source', () => {
  it('every top-level src folder has an alias', () => {
    const targets = new Set(
      Object.values(tsconfigPaths())
        .map(([target]) => target.replace(/\/?\*$/, '').replace(/^\.\//, ''))
        .filter(target => target.startsWith('src/'))
        .map(target => target.slice('src/'.length)),
    );

    const folders = fs
      .readdirSync(path.join(ROOT, 'src'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    expect(folders.filter(folder => !targets.has(folder))).toEqual([]);
  });

  it('check-dead-modules derives its aliases rather than restating them', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'scripts/check-dead-modules.mjs'),
      'utf8',
    );

    expect(source).toContain('prefixPairs()');
    // The literal table it replaced.
    expect(source).not.toMatch(/\['#components\/',\s*'src\/components\/'\]/);
  });

  it('the derived list covers every tsconfig alias', () => {
    const derived = new Set(prefixPairs().map(([alias]) => alias));
    const declared = Object.keys(tsconfigPaths()).map(
      key => `${key.replace(/\/?\*$/, '')}/`,
    );

    expect(declared.filter(alias => !derived.has(alias))).toEqual([]);
  });
});
