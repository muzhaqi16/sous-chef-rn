import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Every relative import in the app's ENTRY POINT resolves to a file.
 *
 * `index.js` sits at the repo root, which is the one place nothing else looks:
 * `check-dead-modules` scans `src/`, Jest never loads the entry point, and
 * `tsconfig.json` lists `index.js` in `include` but leaves `allowJs` unset — so
 * TypeScript skips it and `npm run typecheck` passes over a broken import.
 *
 * The failure mode is total: Metro cannot build the bundle, so the app shows a
 * red screen instead of starting. That happened when
 * `utils/notifications/localNotificationHelper` moved to
 * `services/notifications/` and the entry point was not repointed — every gate
 * stayed green.
 */
const ROOT = resolve(__dirname, '../..');

const EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '/index.ts',
  '/index.tsx',
  '/index.js',
];

const relativeImports = (source: string): { spec: string; line: number }[] => {
  const found: { spec: string; line: number }[] = [];
  const pattern = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    found.push({
      spec: match[1],
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return found;
};

const resolves = (fromFile: string, spec: string): boolean =>
  EXTENSIONS.some(ext => existsSync(join(dirname(fromFile), spec + ext)));

describe("the app's entry point", () => {
  const entry = join(ROOT, 'index.js');
  const source = readFileSync(entry, 'utf8');
  const imports = relativeImports(source);

  // A scanner that finds nothing looks exactly like a clean tree.
  it('has relative imports to check', () => {
    expect(imports.length).toBeGreaterThanOrEqual(5);
  });

  it('resolves every one of them', () => {
    const missing = imports
      .filter(({ spec }) => !resolves(entry, spec))
      .map(({ spec, line }) => `index.js:${line} -> ${spec}`);

    expect(missing).toEqual([]);
  });

  // The check is only worth anything if a moved module actually breaks it.
  it('would fail on a module that moved away', () => {
    expect(resolves(entry, './src/utils/notifications/localNotificationHelper')).toBe(
      false,
    );
    expect(
      resolves(entry, './src/services/notifications/localNotificationHelper'),
    ).toBe(true);
  });
});
