import {
  GetPantryDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { PAGE_SIZE } from '#features/pantry/constants/pagination';
import { pantryItemSearch } from '#/utils/searchUtils';
import {
  useHybridSearch,
  type UseHybridSearchConfig,
  type UseHybridSearchReturn,
} from '#features/pantry/hooks/useHybridSearch';
import type { PantryListItemNode } from '#features/pantry/hooks/usePantryQuery';

// Connection nodes carry direct fields (id, itemName, expiresAt, …) plus an
// opaque `PantryItemCard_pantryItem` fragment ref. The leaf cell unmasks the
// ref via `useFragment`; the hook layer only needs the direct fields for
// local search / sort.
type PantryItem = PantryListItemNode;

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
 * Bakes the GetPantry document, variable shape, extractor and local predicate
 * into the generic `useHybridSearch`. The fixed document is also what lets tests
 * use `recordMock(GetPantryDocument, ...)` directly.
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
    // Server sort/search only kicks in past the full load window — below it the
    // client already holds every item, so sort/filter/search stay local.
    pageSize: PAGE_SIZE.MAX,
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
    // Each node already carries the fields needed for local search + sort
    // (itemName, expiresAt, quantity, …) plus the masked PantryItemCard
    // fragment ref. Pass through without unmasking.
    extractItems: data =>
      extractNodes(data.pantry?.itemsConnection) as PantryItem[],
    searchPredicate: pantryItemSearch,
    debounceMs: 300,
  };

  return useHybridSearch<GetPantryQuery, PantryItem>(config);
}
