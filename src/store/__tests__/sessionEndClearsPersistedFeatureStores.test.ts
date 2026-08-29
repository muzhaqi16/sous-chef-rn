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
 *
 * That list's COMPLETENESS is checked in
 * `persistedFeatureStoresAreClassified.test.ts`, which loads the stores to read
 * their real persist config — the opposite premise, so it lives in its own file.
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
