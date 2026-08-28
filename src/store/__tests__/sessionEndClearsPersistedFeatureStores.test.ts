/**
 * The unloaded-module case: a persisted feature store must be cleared at session
 * end even when the feature was never opened in that session.
 *
 * `sessionEndLeavesNoData.test.ts` cannot see this. It static-imports all four
 * feature stores, and importing them is what runs their
 * `registerSessionScopedStore` call — so it performs the registration whose
 * absence is the defect, and its registry is populated by the test itself.
 *
 * This file deliberately imports NONE of them. Under Metro's `inlineRequires`
 * that is the real shape of a session where the user never opened the scanner:
 * the module is never evaluated, nothing registers, and the only thing standing
 * between user A's scan history and user B is the persisted-key list.
 */

jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');
jest.mock('#/storage/mmkv');

jest.mock('#/storage/keychain', () => ({
  clearTempRegistrationPassword: jest.fn(() => Promise.resolve()),
  clearSessionTokens: jest.fn(() => Promise.resolve()),
  loadSessionTokens: jest.fn(() => Promise.resolve(null)),
  saveSessionTokens: jest.fn(() => Promise.resolve()),
  clearCredentials: jest.fn(() => Promise.resolve()),
}));

jest.mock('#/apollo/client', () => ({
  client: { clearStore: jest.fn(() => Promise.resolve()) },
}));

jest.mock('#/apollo/offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: { clear: jest.fn() },
}));

import fs from 'fs';
import path from 'path';
import {
  resetSessionScopedStores,
  registeredSessionScopedStores,
  SESSION_SCOPED_PERSISTED_KEYS,
} from '#store/sessionScopedStores';
import { storage } from '#/storage/mmkv';

const { __mockStore } = jest.requireMock<{
  __mockStore: Map<string, unknown>;
}>('#/storage/mmkv');

describe('session end clears persisted feature stores that were never loaded', () => {
  beforeEach(() => {
    __mockStore.clear();
    jest.clearAllMocks();
  });

  it('has no registration for a store this session never imported', () => {
    // The premise. If this ever fails, something in the import graph pulled a
    // feature store in and the rest of the file stops testing the real case.
    expect(registeredSessionScopedStores()).toEqual([]);
  });

  it('deletes every session-scoped persisted key', () => {
    for (const key of SESSION_SCOPED_PERSISTED_KEYS) {
      __mockStore.set(
        key,
        JSON.stringify({ state: { recentScans: ['milk'] } }),
      );
    }
    // Something that must survive: this is a device-level preference.
    __mockStore.set('sous-chef-theme', 'dark');

    resetSessionScopedStores();

    for (const key of SESSION_SCOPED_PERSISTED_KEYS) {
      expect(storage.remove).toHaveBeenCalledWith(key);
      expect(__mockStore.has(key)).toBe(false);
    }
    expect(__mockStore.get('sous-chef-theme')).toBe('dark');
  });

  it("clears the scanner's history, which carries item names, brands and UPCs", () => {
    __mockStore.set(
      'sous-chef-barcode',
      JSON.stringify({
        state: {
          recentScans: [{ name: 'Organic Whole Milk', upc: '0123456789012' }],
        },
      }),
    );

    resetSessionScopedStores();

    expect(__mockStore.has('sous-chef-barcode')).toBe(false);
  });

  it('clears the two recipe caches that had the identical hole', () => {
    __mockStore.set('recipe-search-cache', '{"state":{"searches":["pasta"]}}');
    __mockStore.set('recipe-suggestions-cache', '{"state":{"items":[1]}}');

    resetSessionScopedStores();

    expect(__mockStore.has('recipe-search-cache')).toBe(false);
    expect(__mockStore.has('recipe-suggestions-cache')).toBe(false);
  });
});

/**
 * The list is only as good as its completeness, and a new feature store is
 * exactly where it will be forgotten — the defect this fixes was three stores
 * that nobody remembered to classify.
 *
 * Derived from the tree rather than a hand-maintained list, so adding a
 * persisted feature store fails here until someone decides which it is.
 */
describe('every persisted feature store is classified', () => {
  /** Persisted keys deliberately kept across a session end, with the reason. */
  const KEPT_ON_PURPOSE: Record<string, string> = {};

  function featureStoreFiles(): string[] {
    const featuresDir = path.join(__dirname, '..', '..', 'features');
    const found: string[] = [];
    for (const feature of fs.readdirSync(featuresDir)) {
      const storeDir = path.join(featuresDir, feature, 'store');
      if (!fs.existsSync(storeDir)) continue;
      for (const file of fs.readdirSync(storeDir)) {
        if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
          found.push(path.join(storeDir, file));
        }
      }
    }
    return found;
  }

  /** The `name:` a zustand `persist(...)` config declares, if any. */
  function persistedKeys(source: string): string[] {
    if (!/\bpersist\s*\(/.test(source)) return [];
    const keys: string[] = [];
    // Direct literal: `name: 'recipe-search-cache'`
    for (const match of source.matchAll(/name:\s*'([^']+)'/g)) {
      keys.push(match[1]);
    }
    // Via a constant: `const PERSIST_KEY = 'sous-chef-barcode'` + `name: PERSIST_KEY`
    for (const match of source.matchAll(/name:\s*([A-Z_][A-Z0-9_]*)/g)) {
      const constMatch = source.match(
        new RegExp(`${match[1]}\\s*=\\s*'([^']+)'`),
      );
      if (constMatch) keys.push(constMatch[1]);
    }
    return keys;
  }

  it('finds the feature stores it claims to scan', () => {
    const files = featureStoreFiles();
    // A scanner that finds nothing passes vacuously; this is the floor.
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it('classifies every persisted key a feature store declares', () => {
    const unclassified: string[] = [];

    for (const file of featureStoreFiles()) {
      const source = fs.readFileSync(file, 'utf8');
      for (const key of persistedKeys(source)) {
        const known =
          SESSION_SCOPED_PERSISTED_KEYS.includes(key) || key in KEPT_ON_PURPOSE;
        if (!known) unclassified.push(`${key} (${path.basename(file)})`);
      }
    }

    expect(unclassified).toEqual([]);
  });

  it('scans up the three keys that are classified today', () => {
    const scanned = new Set<string>();
    for (const file of featureStoreFiles()) {
      for (const key of persistedKeys(fs.readFileSync(file, 'utf8'))) {
        scanned.add(key);
      }
    }
    // Proves the extraction actually reads both declaration shapes — a literal
    // `name:` and one routed through a module constant.
    for (const key of SESSION_SCOPED_PERSISTED_KEYS) {
      expect(scanned).toContain(key);
    }
  });
});
