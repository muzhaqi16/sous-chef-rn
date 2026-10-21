import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '#/store/deviceStorage';
import { hydrateWhenStarted } from '#store/persistedStores';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
import { isRecord } from '#/utils/isRecord';

/** The longest a catalog read serves a held answer: a pantry item's suggestions. */
const KEPT_MS = 7 * 24 * 60 * 60 * 1000;

export type CatalogField =
  | 'catalogRecipesByIngredients'
  | 'randomCatalogRecipes';

interface CatalogFetchTimesState {
  /** When each held catalog answer arrived complete, by `catalogFetchKey`. */
  fetchedAt: Record<string, number>;
}

const sortedKeys = (_key: string, value: unknown): unknown =>
  isRecord(value) && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
      )
    : value;

/** One answer's key: the field and its arguments, whatever order they came in. */
export const catalogFetchKey = (
  field: CatalogField,
  args: Record<string, unknown> | null,
): string => `${field}:${JSON.stringify(args ?? {}, sortedKeys)}`;

const storedTimes = (persisted: unknown): Record<string, number> =>
  isRecord(persisted) && isRecord(persisted.fetchedAt)
    ? Object.fromEntries(
        Object.entries(persisted.fetchedAt).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number',
        ),
      )
    : {};

/** @internal Test seam: the session-end classification asks the store itself. */
export const useCatalogFetchTimesStore = create<CatalogFetchTimesState>()(
  persist(() => ({ fetchedAt: {} }), {
    name: 'sous-chef-catalog-fetch-times',
    storage: createJSONStorage(() => zustandStorage),
    skipHydration: true,
    version: 1,
    // An answer recorded before hydration finished is newer than the disk's.
    merge: (persisted, current) => ({
      fetchedAt: { ...storedTimes(persisted), ...current.fetchedAt },
    }),
  }),
);

hydrateWhenStarted(useCatalogFetchTimesStore);

registerSessionScopedStore('catalogFetchTimes', () =>
  useCatalogFetchTimesStore.setState({ fetchedAt: {} }),
);

/** Records a complete answer, dropping times no catalog read would still honour. */
export function recordCatalogFetch(key: string, now: number): void {
  useCatalogFetchTimesStore.setState(({ fetchedAt }) => ({
    fetchedAt: {
      ...Object.fromEntries(
        Object.entries(fetchedAt).filter(([, at]) => now - at < KEPT_MS),
      ),
      [key]: now,
    },
  }));
}

export const catalogFetchedAt = (key: string): number | undefined =>
  useCatalogFetchTimesStore.getState().fetchedAt[key];
