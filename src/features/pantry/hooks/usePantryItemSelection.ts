import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  GetPantryDocument,
  CreatePantryItemDocument,
  DeletePantryItemDocument,
  type GetPantryQuery,
  type CreatePantryItemMutation,
  type DeletePantryItemMutation,
} from '#features/pantry/graphql/pantry.generated';
import {
  UsePantryItemSelection_PantryItemFragmentDoc,
  type UsePantryItemSelection_PantryItemFragment,
} from './usePantryItemSelection.generated';
import { removeFromPantryItemsCache } from '#features/pantry/cache/items';
import { extractNodes } from '#/utils/connectionUtils';
import type { CreatePantryItemInput } from '#/graphql/generated/schemaTypes';
import type { MutationOutcome } from '#/utils/errors/mutationOutcome';

type PantryItemsConnection = NonNullable<
  GetPantryQuery['pantry']
>['itemsConnection'];

interface ExistingPantryIndex {
  /** catalog id -> the pantry row's id */
  existingItemMap: Map<string, string>;
  existingCatalogIds: Set<string>;
}

// Keyed by the connection object, which Apollo replaces whenever the underlying
// rows change, so a hit cannot go stale.
const indexCache = new WeakMap<object, ExistingPantryIndex>();

/**
 * Each row is a masked ref, so resolving costs one cache read apiece. The React
 * Compiler leaves this derivation uncached in a component body, so it is cached
 * explicitly against the connection identity.
 */
function buildIndex(
  cache: ApolloCache,
  itemsConnection: PantryItemsConnection | undefined,
): ExistingPantryIndex {
  if (!itemsConnection) {
    return { existingItemMap: new Map(), existingCatalogIds: new Set() };
  }
  const cached = indexCache.get(itemsConnection);
  if (cached) return cached;

  const existingItemMap = new Map<string, string>();
  const existingCatalogIds = new Set<string>();
  for (const ref of extractNodes(itemsConnection)) {
    const pantryItem =
      cache.readFragment<UsePantryItemSelection_PantryItemFragment>({
        fragment: UsePantryItemSelection_PantryItemFragmentDoc,
        fragmentName: 'usePantryItemSelection_pantryItem',
        from: ref as object,
      });
    if (!pantryItem) continue;
    const catalogId = pantryItem.item?.id ?? pantryItem.itemId;
    if (catalogId) {
      existingItemMap.set(catalogId, pantryItem.id);
      existingCatalogIds.add(catalogId);
    }
  }
  const index = { existingItemMap, existingCatalogIds };
  indexCache.set(itemsConnection, index);
  return index;
}

/**
 * Which catalog items a pantry already holds, and the two writes that change
 * that. Public because onboarding's picker needs it before any pantry screen
 * has mounted, and both the pantry's documents and the shape of its item rows
 * are the pantry feature's to know.
 */
export function usePantryItemSelection(pantryId: string | null | undefined) {
  const client = useApolloClient();
  const { data, loading } = useQuery(GetPantryDocument, {
    variables: { id: pantryId!, itemsFirst: 100 },
    skip: !pantryId,
  });

  const [createPantryItem] = useMutation(CreatePantryItemDocument);
  const [deletePantryItem] = useMutation(DeletePantryItemDocument);

  const { existingItemMap, existingCatalogIds } = buildIndex(
    client.cache,
    data?.pantry?.itemsConnection,
  );

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
    /** Local-first: the row is queued when offline, keyed by a client-minted id. */
    addItem: (
      input: CreatePantryItemInput,
    ): Promise<MutationOutcome<CreatePantryItemMutation>> =>
      createPantryItem({
        variables: { input },
        context: { localFirst: true },
      }),
    removeItem: (
      pantryItemId: string,
    ): Promise<MutationOutcome<DeletePantryItemMutation>> =>
      deletePantryItem({
        variables: { input: { id: pantryItemId } },
        update: cache =>
          removeFromPantryItemsCache(cache, pantryId!, pantryItemId),
      }),
  };
}
