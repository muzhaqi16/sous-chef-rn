import { useEffect, useRef } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import {
  GetBrandsDocument,
  GetCategoriesDocument,
} from '#operations/item/item.generated';
import { GetStoresDocument } from '#operations/store/store.generated';
import { GetCommonUnitsDocument } from '#operations/item/unit.generated';
import type { CategorySuggestion } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import {
  useAppStore,
  useIsOnline,
  useIsPantryQueryComplete,
} from '#store/useAppStore';
import { errorService } from '#/services/errorService';

/**
 * Preloads reference data for offline-first autocomplete.
 *
 * Units, categories, brands, and stores are small, slow-changing reference sets
 * that the add/edit forms autocomplete against. We warm them into the Zustand
 * cache while online so the autocomplete hooks can serve matches locally when
 * the device later goes offline (see useUnitAutocomplete and friends, which
 * read these via `localFirst`).
 *
 * Warming is gated on core data having loaded (`hasInitializedHomeData` — set
 * app-wide once the home query fires, or `isPantryQueryComplete` for the pantry
 * tab) so it runs AFTER the important first-paint data, and on `isOnline` so it
 * never fires a doomed request. Using the home signal (not only the pantry one)
 * means a user who lands on the shopping or recipes tab still gets the
 * category/brand/store caches warmed. Each set is refreshed at most once per TTL
 * and is fetched on the idle queue to stay off the interaction path.
 */
const REFERENCE_DATA_TTL = 24 * 60 * 60 * 1000; // 24h

function isStale(lastFetchedAt: number | null, now: number): boolean {
  return lastFetchedAt === null || now - lastFetchedAt >= REFERENCE_DATA_TTL;
}

/**
 * Commit a warmed reference dataset to the Zustand cache. A failed fetch
 * (`rows === undefined`) leaves the timestamp null so the next online tick
 * retries; otherwise the cache is replaced (only when non-empty) and the TTL is
 * stamped. `setCached` drives the element type (`NoInfer` on `rows`) so an
 * inline `__typename` literal narrows against the setter's parameter type.
 */
function commitWarm<T>(
  rows: NoInfer<T>[] | undefined,
  setCached: (rows: T[]) => void,
  setFetchedAt: (timestamp: number) => void,
): void {
  if (rows === undefined) return;
  if (rows.length > 0) setCached(rows);
  setFetchedAt(Date.now());
}

export function useDataPreloading() {
  const isOnline = useIsOnline();
  // Either signal means core data has loaded; the home signal is app-wide so
  // warming isn't limited to users who open the pantry tab.
  const hasInitializedHomeData = useAppStore(
    state => state.hasInitializedHomeData,
  );
  const isPantryQueryComplete = useIsPantryQueryComplete();
  const isReady = hasInitializedHomeData || isPantryQueryComplete;

  const lastUnitsFetchedAt = useAppStore(state => state.lastUnitsFetchedAt);
  const lastCategoriesFetchedAt = useAppStore(
    state => state.lastCategoriesFetchedAt,
  );
  const lastBrandsFetchedAt = useAppStore(state => state.lastBrandsFetchedAt);
  const lastStoresFetchedAt = useAppStore(state => state.lastStoresFetchedAt);

  const [fetchUnits] = useLazyQuery(GetCommonUnitsDocument, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });
  const [fetchCategories] = useLazyQuery(GetCategoriesDocument, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });
  const [fetchBrands] = useLazyQuery(GetBrandsDocument, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });
  const [fetchStores] = useLazyQuery(GetStoresDocument, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  // Guards a dataset from being re-fetched before its timestamp updates.
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isReady || !isOnline) return;

    const now = Date.now();
    const inFlight = inFlightRef.current;

    const warm = (
      key: string,
      lastFetchedAt: number | null,
      run: () => Promise<void>,
    ) => {
      if (inFlight.has(key) || !isStale(lastFetchedAt, now)) return;
      inFlight.add(key);
      requestIdleCallback(() => {
        run()
          .catch(error => {
            // A failed warm skips `commitWarm` entirely, which leaves the
            // timestamp null so the next online tick retries — the same
            // outcome `commitWarm(undefined, …)` produced.
            errorService.reportError(error, { operation: `preload ${key}` });
          })
          .finally(() => inFlight.delete(key));
      });
    };

    // `commitWarm` stamps the timestamp on any resolved fetch (so it isn't
    // re-fetched until the TTL) and skips a genuinely failed fetch (`map` over
    // `undefined` edges yields `undefined`), leaving the timestamp null to retry
    // on the next online tick.
    warm('units', lastUnitsFetchedAt, async () => {
      const result = await fetchUnits();
      const store = useStore.getState();
      commitWarm(
        result?.data?.units,
        store.setCachedUnits,
        store.setLastUnitsFetchedAt,
      );
    });

    warm('categories', lastCategoriesFetchedAt, async () => {
      const result = await fetchCategories();
      const store = useStore.getState();
      commitWarm(
        result?.data?.categories.edges?.map(
          (edge): CategorySuggestion => ({
            __typename: 'CategorySuggestion',
            id: edge.node.id,
            name: edge.node.name,
            type: edge.node.type,
            icon: edge.node.icon,
            color: edge.node.color,
            slug: edge.node.slug,
          }),
        ),
        store.setCachedCategories,
        store.setLastCategoriesFetchedAt,
      );
    });

    warm('brands', lastBrandsFetchedAt, async () => {
      const result = await fetchBrands();
      const store = useStore.getState();
      commitWarm(
        result?.data?.brands.edges?.map(edge => ({
          id: edge.node.id,
          name: edge.node.name,
        })),
        store.setCachedBrands,
        store.setLastBrandsFetchedAt,
      );
    });

    warm('stores', lastStoresFetchedAt, async () => {
      const result = await fetchStores();
      const store = useStore.getState();
      commitWarm(
        result?.data?.stores.edges?.map(edge => ({
          id: edge.node.id,
          name: edge.node.name,
          address: edge.node.address,
        })),
        store.setCachedStores,
        store.setLastStoresFetchedAt,
      );
    });
  }, [
    isReady,
    isOnline,
    lastUnitsFetchedAt,
    lastCategoriesFetchedAt,
    lastBrandsFetchedAt,
    lastStoresFetchedAt,
    fetchUnits,
    fetchCategories,
    fetchBrands,
    fetchStores,
  ]);
}
