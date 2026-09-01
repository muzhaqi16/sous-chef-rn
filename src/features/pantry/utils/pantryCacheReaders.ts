/**
 * Answers "does this pantry already stock that item?" from the cache, so an add
 * does not have to reach the server to find out. Offline the server cannot
 * answer at all, and its refusal carries no usable ids on the replay path.
 */
import { gql, type ApolloCache } from '@apollo/client';
import type { PantryItemDuplicateInfo } from '#/utils/errors/pantryItemDuplicate';
import { logger } from '#/utils/environment';

/**
 * Args declared and passed UNDEFINED on purpose: `itemsConnection` is keyed on
 * them, so client mode stores `itemsConnection:{}`, not a bare
 * `itemsConnection` — reading without them resolves a key that does not exist,
 * and matches nothing with no error to show for it. Server mode misses instead.
 */
const CACHED_PANTRY_ITEMS_FRAGMENT = gql`
  fragment CachedPantryItemsForDuplicateCheck on Pantry {
    id
    itemsConnection(filters: $itemsFilter, orderBy: $itemsOrderBy) {
      edges {
        node {
          id
          itemName
          quantity
          item {
            id
          }
        }
      }
    }
  }
`;

interface CachedPantryItemsForDuplicateCheck {
  itemsConnection: {
    edges: ({
      node: {
        id: string;
        itemName: string | null;
        quantity: number | null;
        item: { id: string } | null;
      } | null;
    } | null)[];
  } | null;
}

/** The matched row, plus what an optimistic restock needs to bump it locally. */
export interface CachedPantryItemDuplicate extends PantryItemDuplicateInfo {
  quantity: number | null;
}

const normalizeName = (name: string | null | undefined): string =>
  (name ?? '').trim().toLowerCase();

/**
 * The server's key is `(pantryId, itemId)` among non-deleted rows, so `itemId`
 * reproduces it exactly. `itemName` is the fallback for the details form, which
 * has no catalog id; a name match only ever drives a prompt, never an action.
 */
export function findCachedPantryItemDuplicate(
  cache: ApolloCache,
  pantryId: string | null | undefined,
  match: { itemId?: string | null; itemName?: string | null },
): CachedPantryItemDuplicate | null {
  if (!pantryId) return null;

  const itemId = match.itemId || null;
  const itemName = normalizeName(match.itemName);
  if (!itemId && !itemName) return null;

  const pantryCacheId = cache.identify({ __typename: 'Pantry', id: pantryId });
  if (!pantryCacheId) return null;

  // Plain statements only in the try body: a value block inside one bails the
  // React Compiler out of the whole function.
  let pantry;
  try {
    pantry = cache.readFragment<CachedPantryItemsForDuplicateCheck>({
      id: pantryCacheId,
      fragment: CACHED_PANTRY_ITEMS_FRAGMENT,
      variables: { itemsFilter: undefined, itemsOrderBy: undefined },
    });
  } catch (error) {
    logger.warn('Pantry duplicate pre-check could not read the cache:', error);
  }

  const edges = pantry?.itemsConnection?.edges;
  if (!edges) return null;

  for (const edge of edges) {
    const node = edge?.node;
    if (!node) continue;
    // An id match is authoritative; the name match only runs when the caller
    // has no catalog id to offer.
    const matched = itemId
      ? node.item?.id === itemId
      : normalizeName(node.itemName) === itemName;
    if (matched) {
      return {
        existingPantryItemId: node.id,
        existingPantryItemIds: [node.id],
        quantity: node.quantity,
      };
    }
  }

  return null;
}
