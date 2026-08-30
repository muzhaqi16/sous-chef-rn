/**
 * Every persisted feature store is classified: cleared at session end, or named
 * as deliberately kept.
 *
 * This replaces a scan of the source text, which asked the wrong question. It
 * looked for `name: '...'` inside `src/features/<f>/store/*.ts`, so it was blind
 * to three shapes that all persist perfectly well at runtime:
 *
 *  - a store one directory deeper (`store/scanner/history.ts`) — the walk was
 *    one level and did not recurse;
 *  - a key written with double quotes — the pattern only matched single;
 *  - a key imported from another module — the constant lookup was a regex for
 *    an assignment in the SAME file.
 *
 * Each was reported as "no persisted key here", which reads identically to a
 * store that is genuinely classified. A guard whose failure mode is silence is
 * the same guard the leak got past in the first place.
 *
 * So this asks the store itself. zustand's persist middleware exposes its
 * resolved config as `store.persist.getOptions().name`, which is the value that
 * actually reaches storage — after the constant, the import and the quoting have
 * all been resolved by the module system rather than by a pattern.
 */

jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');
jest.mock('#/storage/mmkv');

import fs from 'fs';
import os from 'os';
import path from 'path';
import { SESSION_SCOPED_PERSISTED_KEYS } from '#store/sessionScopedStores';

/** Persisted keys deliberately kept across a session end, with the reason. */
const KEPT_ON_PURPOSE: Record<string, string> = {};

/** A zustand store with the persist middleware applied. */
type PersistedStore = {
  persist: { getOptions: () => { name?: string } };
};

function isPersistedStore(value: unknown): value is PersistedStore {
  return (
    typeof value === 'function' &&
    typeof (value as { persist?: { getOptions?: unknown } }).persist
      ?.getOptions === 'function'
  );
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Any depth. The old walk stopped at `<feature>/store/`, which is a
      // convention, not a constraint the runtime enforces.
      if (entry.name !== '__tests__' && entry.name !== '__mocks__') {
        found.push(...sourceFiles(full));
      }
    } else if (
      /\.(ts|tsx|js)$/.test(entry.name) &&
      !entry.name.endsWith('.d.ts')
    ) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Every persisted key reachable from `root`, read off the live store.
 *
 * The source text is consulted only to decide which modules are worth loading —
 * never to extract the key. A file that mentions `persist(` but declares its
 * name some other way is still loaded, and still answers.
 */
function discoverPersistedKeys(root: string): { key: string; file: string }[] {
  const found: { key: string; file: string }[] = [];
  for (const file of sourceFiles(root)) {
    if (!/\bpersist\s*\(/.test(fs.readFileSync(file, 'utf8'))) continue;
    const loaded: Record<string, unknown> = require(file);
    for (const exported of Object.values(loaded)) {
      if (!isPersistedStore(exported)) continue;
      const key = exported.persist.getOptions().name;
      if (key) found.push({ key, file: path.relative(root, file) });
    }
  }
  return found;
}

const FEATURES = path.join(__dirname, '..', '..', 'features');

describe('every persisted feature store is classified', () => {
  it('finds the stores it claims to check', () => {
    // An empty observation must fail, not pass. "Found nothing" and "nothing to
    // find" are the same result to a caller and opposite facts.
    const keys = discoverPersistedKeys(FEATURES).map(entry => entry.key);
    expect(keys.length).toBeGreaterThanOrEqual(
      SESSION_SCOPED_PERSISTED_KEYS.length,
    );
    for (const key of SESSION_SCOPED_PERSISTED_KEYS) {
      expect(keys).toContain(key);
    }
  });

  it('classifies every persisted key a feature store declares', () => {
    const unclassified = discoverPersistedKeys(FEATURES)
      .filter(
        entry =>
          !SESSION_SCOPED_PERSISTED_KEYS.includes(entry.key) &&
          !(entry.key in KEPT_ON_PURPOSE),
      )
      .map(entry => `${entry.key} (${entry.file})`);

    expect(unclassified).toEqual([]);
  });
});

describe('the three shapes the source scan could not see', () => {
  let fixtures: string;

  beforeAll(() => {
    fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'persisted-stores-'));

    const store = (name: string) => `
      const store = () => {};
      store.persist = { getOptions: () => ({ name: ${name} }) };
      module.exports = { store };
      // persist(
    `;

    // One directory deeper than the convention.
    const nested = path.join(fixtures, 'deep', 'store', 'history');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'index.js'), store("'nested-key'"));

    // A double-quoted name.
    const quoted = path.join(fixtures, 'quoted', 'store');
    fs.mkdirSync(quoted, { recursive: true });
    fs.writeFileSync(path.join(quoted, 'index.js'), store('"quoted-key"'));

    // A key that lives in another module.
    const imported = path.join(fixtures, 'imported', 'store');
    fs.mkdirSync(imported, { recursive: true });
    fs.writeFileSync(
      path.join(imported, 'keys.js'),
      "module.exports = { PERSIST_KEY: 'imported-key' };",
    );
    fs.writeFileSync(
      path.join(imported, 'index.js'),
      store("require('./keys').PERSIST_KEY"),
    );
  });

  afterAll(() => fs.rmSync(fixtures, { recursive: true, force: true }));

  it('sees all three', () => {
    const keys = discoverPersistedKeys(fixtures).map(entry => entry.key);
    expect(keys.sort()).toEqual(['imported-key', 'nested-key', 'quoted-key']);
  });
});
