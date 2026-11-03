import { skipToken, useLazyQuery, useQuery } from '@apollo/client/react';
import { logger } from '#/utils/environment';
import { useAppStore } from '#store/useAppStore';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useDebouncedValue } from '#hooks/utils/useDebouncedValue';
import { filterByTerm, matchesTerm } from '#hooks/search/useLocalSearch';
import { ErrorCode, StorePlaceCategory } from '#/graphql/generated/schemaTypes';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import {
  chainOption,
  placeOption,
  storeOption,
  type FoundOption,
  type StoreOption,
} from '#domain/stores';
import { filterByName } from '#features/catalog/utils/arrayUtils';
import { useAutocompleteSearch } from './useAutocompleteSearch';
import { useUsualStores } from './useUsualStores';
import { StorePlacesDocument } from './useStoreSearch.generated';

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
  hasCollectedPrices?: boolean;
  priceStandIn?: object | null;
}

const MIN_TERM = 2;
const DEBOUNCE_MS = 300;
const EVERY_KIND_OF_SHOP = Object.values(StorePlaceCategory);

interface StoreSearchOptions {
  /** The household whose stores read as added, and stand in offline. */
  household?: { homeId: string | null };
  /** Where nearby stores are found from, nearest first; a term narrows them. */
  place?: StoreSearchPlace | null;
  /** Also offer each chain a term names, as any of its stores. */
  chains?: boolean;
  /** Marks a store priced from shelf prices; the picker passes Budget & prices. */
  markPrices?: boolean;
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
  markPrices = false,
  listBeforeTyping = true,
  maxResults = 10,
}: StoreSearchOptions = {}) {
  const isOffline = useIsApiUnavailable();
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
      void searchStores({
        variables: { search: term, limit: 20, withPrices: markPrices },
      }).catch(error => logger.warn('Store search failed', error));
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
  });

  const typed = useDebouncedValue(byName.searchTerm.trim(), DEBOUNCE_MS);
  const search = typed.length >= MIN_TERM ? typed : null;
  const nearby = useQuery(
    StorePlacesDocument,
    place && !isOffline
      ? {
          variables: {
            input: {
              near: place.point ? { point: place.point } : { zip: place.zip },
              // Unnamed, the server lists what groceries come from; a typed
              // name says what is wanted, whatever kind of shop it is.
              ...(search && { search, categories: EVERY_KIND_OF_SHOP }),
            },
            withPrices: markPrices,
          },
          // The default policy asks again on each visit, since a place picked
          // after the persisted answer is a held store now. No resync: it would
          // re-ask for a list nobody is reading.
          refetchOn: false,
        }
      : skipToken,
  );

  const added = new Set(usualStores?.map(row => row.key));
  const storeFound = (store: FoundStore, distanceKm: number | null) => {
    const option = storeOption(store, {
      distanceKm,
      hasPrices: !!store.hasCollectedPrices || !!store.priceStandIn,
    });
    return { ...option, added: added.has(option.key) };
  };

  // A skipped query keeps its last answer, so only the active one is read.
  const showsUsual = isOffline && !!usualStores;
  const places = place && !showsUsual ? nearby.data?.storePlaces ?? null : null;
  const heldByName: FoundStore[] =
    !place && !showsUsual && (search || listBeforeTyping)
      ? byName.displayItems
      : [];
  const stores: FoundOption[] = places
    ? places.flatMap(({ store, placeId, name, address, distanceKm }) => {
        if (store) return [storeFound(store, distanceKm)];
        return placeId
          ? [placeOption({ placeId, name, address, distanceKm })]
          : [];
      })
    : heldByName.map(store => storeFound(store, null));
  const chainsNamed = new Map<string, StoreOption>();
  const heldFound: FoundStore[] = places
    ? places.flatMap(({ store }) => store ?? [])
    : heldByName;
  for (const { chain } of chains && search ? heldFound : []) {
    if (chain && search && matchesTerm(chain, search, ['name'])) {
      const option = chainOption(chain);
      chainsNamed.set(option.key, { ...option, added: added.has(option.key) });
    }
  }

  // Offline, the household's own stores stand in, narrowed by the term.
  const heldStores =
    isOffline && usualStores
      ? filterByTerm(usualStores, byName.searchTerm, [
          ({ choice }) => (choice.store ?? choice.chain).name,
        ])
      : null;

  const options: FoundOption[] = heldStores
    ? [...heldStores]
    : [...chainsNamed.values(), ...stores];
  const pending = place ? nearby.loading : byName.searchPending;
  const term = byName.searchTerm.trim();
  const refusal = place?.zip ? getTopLevelGraphQLError(nearby.error) : null;

  return {
    term: byName.searchTerm,
    setTerm: byName.handleSearchTermChange,
    clearTerm: () => {
      byName.setSearchTerm('');
    },
    /** Chains first, then stores and places; offline, the household's stores. */
    options,
    /** The attribution a listed place carries; shown while one is listed. */
    credit: places?.find(row => row.credit)?.credit ?? null,
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
    isOffline,
  };
}
