import fs from 'fs';
import path from 'path';
import { sync as glob } from 'glob';

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

  // `#/x` reached src beside `#x`, so a ban written for one spelling missed
  // the other. Only the test helpers keep the slash.
  it('reaches src by one spelling', () => {
    const slashed = Object.keys(tsconfigPaths()).filter(
      alias => alias.startsWith('#/') && !alias.startsWith('#/test-utils'),
    );

    expect(slashed).toEqual([]);
  });

  /** A `#/` module path outside the test helpers: it resolves to nothing. */
  const SLASHED_PATH = /#\/(?!test-utils)[a-z]/;

  it('sees a slashed path, and not the test helpers', () => {
    expect(SLASHED_PATH.test("from '#/utils/formatQuantity'")).toBe(true);
    expect(SLASHED_PATH.test("from '#/test-utils/render'")).toBe(false);
  });

  it('is the spelling every lint message and doc gives', () => {
    const files = glob('{eslint/**/*.js,docs/**/*.md,CLAUDE.md}', {
      cwd: ROOT,
      ignore: ['docs/audits/**'],
    });

    const slashed = files
      .filter(file =>
        SLASHED_PATH.test(fs.readFileSync(path.join(ROOT, file), 'utf8')),
      )
      .sort();

    expect(slashed).toEqual([]);
  });
});
