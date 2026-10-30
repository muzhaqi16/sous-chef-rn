import { skipToken, useLazyQuery, useQuery } from '@apollo/client/react';
import { logger } from '#/utils/environment';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { useDebouncedValue } from '#hooks/utils/useDebouncedValue';
import { filterByTerm, matchesTerm } from '#hooks/search/useLocalSearch';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import { chainOption, storeOption, type StoreOption } from '#domain/stores';
import { filterByName } from '#features/catalog/utils/arrayUtils';
import { useAutocompleteSearch } from './useAutocompleteSearch';
import { useUsualStores } from './useUsualStores';
import { NearbyStoresDocument } from './useStoreSearch.generated';

/** Where nearby stores are found from: a typed zip, or the device's place. */
export type StoreSearchPlace =
  | { zip: string; point?: undefined }
  | { point: { lat: number; lng: number }; zip?: undefined };

interface FoundStore {
  id: string;
  name: string;
  address?: string | null;
  storeNumber?: string | null;
  chain?: { id: string; name: string } | null;
}

const MIN_TERM = 2;
const DEBOUNCE_MS = 300;

interface StoreSearchOptions {
  /** The household whose stores read as added, and stand in offline. */
  household?: { homeId: string | null };
  /** Where nearby stores are found from, nearest first; a term narrows them. */
  place?: StoreSearchPlace | null;
  /** Also offer each chain a term names, as any of its stores. */
  chains?: boolean;
  /**
   * Lists the warmed store cache before a term is typed, as a store field
   * does; the picker waits for a term or a place instead.
   */
  listBeforeTyping?: boolean;
  maxResults?: number;
}

/**
 * The one way the app finds a store: by name or address, near a place, or a
 * whole chain; which are already the household's; and the typed name to add
 * when none is it. Offline it lists the household's stores, else the warmed
 * store cache. Every store field and the store picker read it.
 */
export function useStoreSearch({
  household,
  place = null,
  chains = false,
  listBeforeTyping = true,
  maxResults = 10,
}: StoreSearchOptions = {}) {
  const isOnline = useIsOnline();
  const { stores: usualStores } = useUsualStores(household?.homeId ?? null, {
    fetchPolicy: 'cache-first',
    skip: !household,
  });
  // Reference data warmed while online (useDataPreloading) for offline use.
  const cachedStores = useAppStore(state => state.cachedStores);
  const [searchStores, named] = useLazyQuery(SearchStoresDocument, {
    refetchOn: false,
  });

  // Online, the full catalog is searched: the warmed cache is the first ~100
  // stores, so a store outside it with a cached name would be unreachable.
  const byName = useAutocompleteSearch<FoundStore>({
    search: term => {
      if (place) return;
      void searchStores({ variables: { search: term, limit: 20 } }).catch(
        error => logger.warn('Store search failed', error),
      );
    },
    getResults: () => named.data?.stores.edges.map(edge => edge.node) ?? [],
    loading: named.loading,
    keyExtractor: store => store.id,
    minChars: MIN_TERM,
    debounceMs: DEBOUNCE_MS,
    requiresNetwork: true,
    fallbackItems: cachedStores,
    filterFallback: filterByName,
    maxResults,
    localFirst: !isOnline,
  });

  const typed = useDebouncedValue(byName.searchTerm.trim(), DEBOUNCE_MS);
  const search = typed.length >= MIN_TERM ? typed : null;
  const nearby = useQuery(
    NearbyStoresDocument,
    place && isOnline
      ? {
          variables: {
            input: {
              near: place.point ? { point: place.point } : { zip: place.zip },
              ...(search && { search }),
            },
          },
          fetchPolicy: 'cache-first',
          // A search: the resync would re-ask for a list nobody is reading.
          refetchOn: false,
        }
      : skipToken,
  );

  const added = new Set(usualStores?.map(row => row.key));
  // A skipped query keeps its last answer, so only the active one is read.
  const found: { store: FoundStore; distanceKm: number | null }[] | null =
    !isOnline && usualStores
      ? null
      : place
      ? nearby.data?.nearbyStores ?? null
      : search || listBeforeTyping
      ? byName.displayItems.map(store => ({ store, distanceKm: null }))
      : null;

  const stores = found?.map(({ store, distanceKm }) => {
    const option = storeOption(store, { distanceKm });
    return { ...option, added: added.has(option.key) };
  });
  const chainsNamed = new Map<string, StoreOption>();
  for (const { store } of chains && search ? found ?? [] : []) {
    const { chain } = store;
    if (chain && search && matchesTerm(chain, search, ['name'])) {
      const option = chainOption(chain);
      chainsNamed.set(option.key, { ...option, added: added.has(option.key) });
    }
  }

  // Offline, the household's own stores stand in, narrowed by the term.
  const offline =
    !isOnline && usualStores
      ? filterByTerm(usualStores, byName.searchTerm, [
          ({ choice }) => (choice.store ?? choice.chain).name,
        ])
      : null;

  const options: StoreOption[] = offline
    ? [...offline]
    : [...chainsNamed.values(), ...(stores ?? [])];
  const pending = place ? nearby.loading : byName.searchPending;
  const term = byName.searchTerm.trim();
  const refusal = place?.zip ? getTopLevelGraphQLError(nearby.error) : null;

  return {
    term: byName.searchTerm,
    setTerm: byName.handleSearchTermChange,
    clearTerm: () => {
      byName.setSearchTerm('');
    },
    /** Chains first, then stores; offline, the household's stores. */
    options,
    /** A list has answered: nearby stores, or a search of two letters or more. */
    answered: place ? !!nearby.data && !nearby.loading : !!search && !pending,
    loading: place ? nearby.loading && !nearby.data : byName.isLoading,
    /**
     * The typed name a new store would take, once its search has answered and
     * no store of that name without an address is listed: a new one has no
     * address, so a branch of the name is another shop (the API's matchKey).
     */
    unlistedName:
      term.length >= MIN_TERM &&
      !pending &&
      !options.some(
        option =>
          option.choice.store &&
          !option.address &&
          option.choice.store.name.trim().toLowerCase() === term.toLowerCase(),
      )
        ? term
        : null,
    /** The zip searched near is not one the API has on file. */
    zipRefused: refusal?.code === ErrorCode.ValidationFailed,
    isOnline,
  };
}
