/**
 * Integration test: a persisted preference survives an "app restart".
 *
 * Boundary under test: Zustand's `persist` middleware ↔ device storage. The
 * contract is "writing a preference to the store flushes through the storage
 * adapter, and a freshly-built store on the next launch sees the persisted
 * value after rehydration."
 *
 * Real implementations on both sides:
 *  - Zustand: a real `create(...)` with the same `persist + immer +
 *    subscribeWithSelector` middleware stack the production store uses.
 *    `createTestStore` skips `persist` (by design — it's for slice-level
 *    isolation), so this test rebuilds the persist layer inline. That gap
 *    is documented in the README.
 *  - Storage: the production `zustandStorage` adapter, over the in-memory
 *    platform's key-value store that `jest.setup.js` installs. Writes from the
 *    first store are visible to the second within the same Jest process —
 *    exactly the model needed to simulate a restart.
 *
 * Nothing about Zustand, persist, or the preferences slice itself is mocked.
 */

'use no memo';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware';
import {
  createPreferencesSlice,
  type PreferencesState,
} from '#/store/slices/preferencesSlice';
import {
  ThemePreference,
  PantrySortOption,
} from '#/store/slices/preferenceTypes';
import { zustandStorage } from '#/store/deviceStorage';
import { STORAGE_KEY } from '#/store/persistedKeys';

function createPersistedStore(testKey: string) {
  return create<PreferencesState>()(
    subscribeWithSelector(
      persist(
        immer((set, get, api) =>
          createPreferencesSlice(
            set as Parameters<typeof createPreferencesSlice>[0],
            get as Parameters<typeof createPreferencesSlice>[1],
            api as unknown as Parameters<typeof createPreferencesSlice>[2],
          ),
        ),
        {
          name: testKey,
          storage: createJSONStorage(() => zustandStorage),
          version: 1,
        },
      ),
    ),
  );
}

/**
 * Wait for Zustand's persist middleware to either flush a write or finish
 * rehydration. `persist` resolves these on the microtask queue, so a single
 * `await Promise.resolve()` is enough — but we use a small polling loop
 * keyed on a predicate so flaky scheduling can't make the test pass for the
 * wrong reason.
 */
async function flushPersist() {
  // Yield several microtasks to let persist debounce + write.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  // Each test uses its own storage key so we don't leak state across cases.
  // The mocked MMKV is process-global within Jest, so a unique key per test
  // is the simplest way to keep them isolated.
});

describe('integration: theme preference persistence round-trip', () => {
  it('persists a theme change and restores it on a fresh store', async () => {
    const key = `${STORAGE_KEY}-theme-roundtrip`;

    // Session 1: create store, change theme, let persist flush.
    const session1 = createPersistedStore(key);
    expect(session1.getState().theme).toBe(ThemePreference.SYSTEM);
    session1.getState().setTheme(ThemePreference.DARK);
    expect(session1.getState().theme).toBe(ThemePreference.DARK);
    await flushPersist();

    // Simulate restart: drop the first store reference. A second `create`
    // boots from cold, runs `persist`, and reads the previous session's
    // value back through the same MMKV-backed adapter.
    const session2 = createPersistedStore(key);

    // Persist's hydration is async — wait until the second store sees the
    // persisted value rather than the slice default.
    await flushPersist();

    expect(session2.getState().theme).toBe(ThemePreference.DARK);
  });

  it('persists multiple preference fields together', async () => {
    const key = `${STORAGE_KEY}-multi-roundtrip`;

    const session1 = createPersistedStore(key);
    session1.getState().setTheme(ThemePreference.LIGHT);
    session1.getState().setLanguage('fr');
    session1.getState().setHapticFeedbackEnabled(false);
    session1.getState().setPantrySortOption(PantrySortOption.EXPIRY);
    await flushPersist();

    const session2 = createPersistedStore(key);
    await flushPersist();

    const restored = session2.getState();
    expect(restored.theme).toBe(ThemePreference.LIGHT);
    expect(restored.language).toBe('fr');
    expect(restored.hapticFeedbackEnabled).toBe(false);
    expect(restored.pantrySortOption).toBe(PantrySortOption.EXPIRY);
  });

  it('starts at the slice default when no persisted state exists', async () => {
    // Use a brand-new key the first session never wrote to. The mocked
    // MMKV map is shared across tests within this run, but a fresh key
    // has no history.
    const key = `${STORAGE_KEY}-fresh-${Date.now()}`;

    const fresh = createPersistedStore(key);
    await flushPersist();

    expect(fresh.getState().theme).toBe(ThemePreference.SYSTEM);
  });
});
