import { skipToken, useQuery } from '@apollo/client/react';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UsePantryItemSelection_PantryItemFragmentDoc,
  type UsePantryItemSelection_PantryItemFragment,
} from './usePantryItemSelection.generated';
import { usePantryItemMutations } from '#features/pantry/hooks/mutations/usePantryItemMutations';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { extractNodes } from '#/utils/connectionUtils';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import { useToday } from '#hooks/useToday';

interface ExistingPantryIndex {
  /** catalog id -> the pantry row's id */
  existingItemMap: Map<string, string>;
  existingCatalogIds: Set<string>;
}

type PantryRow = UsePantryItemSelection_PantryItemFragment | null;

// Keyed by the live rows array, which Apollo replaces whenever a row changes,
// so a hit cannot go stale.
const indexCache = new WeakMap<readonly PantryRow[], ExistingPantryIndex>();

/**
 * The React Compiler leaves this derivation uncached in a component body, so
 * it is cached explicitly against the rows' identity.
 */
function buildIndex(rows: readonly PantryRow[]): ExistingPantryIndex {
  const cached = indexCache.get(rows);
  if (cached) return cached;

  const existingItemMap = new Map<string, string>();
  const existingCatalogIds = new Set<string>();
  for (const pantryItem of rows) {
    if (!pantryItem) continue;
    const catalogId = pantryItem.item.id;
    if (catalogId) {
      existingItemMap.set(catalogId, pantryItem.id);
      existingCatalogIds.add(catalogId);
    }
  }
  const index = { existingItemMap, existingCatalogIds };
  indexCache.set(rows, index);
  return index;
}

/**
 * Which catalog items a pantry already holds, and the two writes that change
 * that. Public because onboarding's picker needs it before any pantry screen
 * has mounted, and both the pantry's documents and the shape of its item rows
 * are the pantry feature's to know.
 */
export function usePantryItemSelection(pantryId: string | null | undefined) {
  const today = useToday();
  const { data, loading, refetch } = useQuery(
    GetPantryDocument,
    pantryId
      ? {
          variables: {
            id: pantryId,
            itemsFirst: 100,
            today,
          },
        }
      : skipToken,
  );

  const { removeItem } = usePantryItemMutations({
    pantryId: pantryId ?? undefined,
    refetch: () => {
      void refetch();
    },
  });

  const { addItem } = usePantryIntake(pantryId ?? undefined);

  const rows = useFragmentList({
    fragment: UsePantryItemSelection_PantryItemFragmentDoc,
    fragmentName: 'usePantryItemSelection_pantryItem',
    from: extractNodes(data?.pantry?.itemsConnection),
  });
  const { existingItemMap, existingCatalogIds } = buildIndex(rows);

  return {
    existingItemMap,
    existingCatalogIds,
    loading,
    /**
     * Whether the pantry read has anything to show. `cache-and-network` reports
     * `loading: true` on EVERY mount whatever the cache holds, so a caller that
     * gates on `loading` alone blanks the screen on every revisit.
     */
    hasLoaded: !!data?.pantry,
    addItem,
    /** Local-first: the row leaves the cache before the delete fires. */
    removeItem,
  };
}
