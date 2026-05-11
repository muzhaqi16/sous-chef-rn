import {
  GetPantryDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  normalizePantry,
  type NormalizedPantry,
} from '#/utils/connectionUtils';
import { PAGE_SIZE } from '#/constants/pagination';
import { pantryItemSearch } from '#/utils/searchUtils';
import {
  useHybridSearch,
  type UseHybridSearchConfig,
  type UseHybridSearchReturn,
} from '#hooks/search/useHybridSearch';

type PantryItem = NonNullable<NormalizedPantry<any>['items']>[number];

export interface UseHybridPantrySearchParams {
  /** Pantry ID — search is disabled when null/empty. */
  pantryId: string | null | undefined;
  /** Filter passed to itemsFilter (location, etc); search term is merged in. */
  locationQueryFilter?: Record<string, unknown> | null;
  /** Order-by passed to itemsOrderBy. */
  orderBy: unknown;
  /** Items to filter locally when local search wins (cached query results). */
  items: PantryItem[];
  /** Server-reported total count (drives server-vs-local decision). */
  totalCount: number;
  /** Whether more pages remain. */
  hasMore: boolean;
  /** Whether the main pantry query is loading. */
  loading: boolean;
  /** Whether the device is online. */
  isOnline: boolean;
}

/**
 * Pantry-specific wrapper around the generic `useHybridSearch` primitive. Bakes
 * in the GetPantry document, the variable shape (id + itemsFilter + orderBy),
 * the result extractor (normalizePantry → items), and the local search
 * predicate. Callers just supply the pantry context.
 *
 * The generic `useHybridSearch` is harder to test because its document is a
 * runtime parameter; this wrapper has a fixed document, so tests can use
 * `recordMock(GetPantryDocument, ...)` directly.
 */
export function useHybridPantrySearch({
  pantryId,
  locationQueryFilter,
  orderBy,
  items,
  totalCount,
  hasMore,
  loading,
  isOnline,
}: UseHybridPantrySearchParams): UseHybridSearchReturn<PantryItem> {
  const config: UseHybridSearchConfig<GetPantryQuery, PantryItem> = {
    items,
    totalCount,
    hasMore,
    loading,
    pageSize: PAGE_SIZE.EXTENDED,
    isOnline,
    searchDocument: GetPantryDocument,
    buildSearchVariables: search => {
      if (!pantryId?.trim()) return null;
      return {
        id: pantryId,
        itemsFirst: PAGE_SIZE.DEFAULT,
        itemsFilter: { ...(locationQueryFilter ?? {}), search },
        itemsOrderBy: orderBy,
        storageLocationsFirst: 0,
      };
    },
    extractItems: data => normalizePantry(data.pantry)?.items ?? [],
    searchPredicate: pantryItemSearch,
    debounceMs: 300,
  };

  return useHybridSearch<GetPantryQuery, PantryItem>(config);
}
