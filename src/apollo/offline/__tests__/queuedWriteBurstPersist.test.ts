import type { NormalizedCacheObject } from '@apollo/client';
import { storage } from '#/storage/mmkv';
import { apolloCachePersistence } from '../ApolloCachePersistence';

jest.mock('#/storage/mmkv');

/**
 * Every queued write flushes the persisted cache so a kill cannot lose the row
 * its replay reads. Each flush is a full extract + stringify + write, so a bulk
 * offline add — the low-stock "add all", onboarding's up-to-100 items — paid it
 * once per row on the JS thread.
 */

/** A store of roughly the size the persist telemetry reports (~165 KB). */
function storeWith(changedRow: number): NormalizedCacheObject {
  const store: NormalizedCacheObject = {
    ROOT_QUERY: { __typename: 'Query' },
  };
  for (let row = 0; row < 1500; row++) {
    store[`PantryItem:pi-${row}`] = {
      __typename: 'PantryItem',
      id: `pi-${row}`,
      itemName: `Pantry item number ${row}`,
      quantity: row === changedRow ? 999 : row,
      notes: 'x'.repeat(40),
    };
  }
  return store;
}

const persistedWrites = () =>
  (storage.set as jest.Mock).mock.calls.filter(
    ([key]) => key === 'apollo-cache-v1',
  ).length;

describe('a burst of queued writes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (storage.set as jest.Mock).mockClear();
    apolloCachePersistence.cancel();
  });
  afterEach(() => jest.useRealTimers());

  it('persists a number of times that does not grow with the burst', () => {
    for (let write = 0; write < 100; write++) {
      const snapshot = storeWith(write);
      apolloCachePersistence.scheduleExtractAndSave(() => snapshot);
      apolloCachePersistence.flushPending();
    }
    jest.runOnlyPendingTimers();

    expect(persistedWrites()).toBeLessThanOrEqual(2);
  });

  it('still persists the first write of a burst at once', () => {
    const snapshot = storeWith(0);
    apolloCachePersistence.scheduleExtractAndSave(() => snapshot);
    apolloCachePersistence.flushPending();

    // Before any timer runs: the row a kill would otherwise lose is on disk.
    expect(persistedWrites()).toBe(1);
  });

  it('skips a persist when only the transient mutation root changed', () => {
    const base = storeWith(0);
    apolloCachePersistence.scheduleExtractAndSave(() => base);
    apolloCachePersistence.flushPending();
    jest.runOnlyPendingTimers();
    (storage.set as jest.Mock).mockClear();

    // Apollo writes each mutation's result under ROOT_MUTATION right after
    // the flush; nothing durable changed.
    const withResult = {
      ...base,
      ROOT_MUTATION: { __typename: 'Mutation', addItem: { id: 'x' } },
    };
    apolloCachePersistence.scheduleExtractAndSave(() => withResult);
    apolloCachePersistence.flushPending();

    expect(persistedWrites()).toBe(0);
  });
});
