import { useEffect, useRef } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import {
  GetBrandsDocument,
  GetCategoriesDocument,
} from '#operations/item/item.generated';
import { GetStoresDocument } from '#operations/store/store.generated';
import { GetCommonUnitsDocument } from '#operations/item/unit.generated';
import { useStore } from '#store';
import {
  useAppStore,
  useIsOnline,
  useIsPantryQueryComplete,
} from '#store/useAppStore';
import { executeQuery } from '#/utils/compilerSafeWrappers';

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
        run().finally(() => inFlight.delete(key));
      });
    };

    // On a resolved fetch (data present, even empty) we stamp the timestamp so
    // it isn't re-fetched until the TTL; only a genuinely failed fetch (data
    // undefined) leaves the timestamp null to retry on the next online tick.
    warm('units', lastUnitsFetchedAt, async () => {
      const result = await executeQuery(() => fetchUnits(), 'preload units');
      const units = result?.data?.units;
      if (units === undefined) return;
      const store = useStore.getState();
      if (units.length > 0) store.setCachedUnits(units);
      store.setLastUnitsFetchedAt(Date.now());
    });

    warm('categories', lastCategoriesFetchedAt, async () => {
      const result = await executeQuery(
        () => fetchCategories(),
        'preload categories',
      );
      const edges = result?.data?.categories.edges;
      if (edges === undefined) return;
      const store = useStore.getState();
      if (edges.length > 0) {
        store.setCachedCategories(
          edges.map(edge => ({
            __typename: 'CategorySuggestion',
            id: edge.node.id,
            name: edge.node.name,
            type: edge.node.type,
            icon: edge.node.icon,
            color: edge.node.color,
            slug: edge.node.slug,
          })),
        );
      }
      store.setLastCategoriesFetchedAt(Date.now());
    });

    warm('brands', lastBrandsFetchedAt, async () => {
      const result = await executeQuery(() => fetchBrands(), 'preload brands');
      const edges = result?.data?.brands.edges;
      if (edges === undefined) return;
      const store = useStore.getState();
      if (edges.length > 0) {
        store.setCachedBrands(
          edges.map(edge => ({ id: edge.node.id, name: edge.node.name })),
        );
      }
      store.setLastBrandsFetchedAt(Date.now());
    });

    warm('stores', lastStoresFetchedAt, async () => {
      const result = await executeQuery(() => fetchStores(), 'preload stores');
      const edges = result?.data?.stores.edges;
      if (edges === undefined) return;
      const store = useStore.getState();
      if (edges.length > 0) {
        store.setCachedStores(
          edges.map(edge => ({
            id: edge.node.id,
            name: edge.node.name,
            address: edge.node.address,
          })),
        );
      }
      store.setLastStoresFetchedAt(Date.now());
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
