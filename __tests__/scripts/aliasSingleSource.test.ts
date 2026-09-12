import fs from 'fs';
import path from 'path';

/**
 * `tsconfig.json` is the single source for module aliases.
 *
 * CLAUDE.md: "Add an alias in ONE place." `babel.config.js` and
 * `jest.config.js` already derive theirs through `scripts/lib/aliases.js`, and
 * ESLint and knip read tsconfig directly. A hand-maintained copy drifts in both
 * directions: a module reached only through a missing alias reads as
 * unreferenced; one reached through a stale alias reads as referenced.
 *
 * Also: every top-level `src/` folder gets an alias. Five did not — `apollo`,
 * `app` (the composition root the PR introduced), `i18n`, `native` and `theme` —
 * while CLAUDE.md states that every one of them does.
 */

const ROOT = path.join(__dirname, '..', '..');

const tsconfigPaths = (): Record<string, string[]> => {
  const raw = fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf8');
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '')).compilerOptions.paths;
};

describe('module aliases have one source', () => {
  it('every top-level src folder has an alias', () => {
    const targets = new Set(
      Object.values(tsconfigPaths())
        .map(([target]) => target!.replace(/\/?\*$/, '').replace(/^\.\//, ''))
        .filter(target => target.startsWith('src/'))
        .map(target => target.slice('src/'.length)),
    );

    const folders = fs
      .readdirSync(path.join(ROOT, 'src'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    expect(folders.filter(folder => !targets.has(folder))).toEqual([]);
  });

});
