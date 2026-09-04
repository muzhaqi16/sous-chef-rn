/**
 * Answers "does this pantry already stock that item?" from the cache, so an add
 * does not have to reach the server to find out. Offline the server cannot
 * answer at all, and its refusal carries no usable ids on the replay path.
 */
import { gql, type ApolloCache } from '@apollo/client';
import type { PantryItemDuplicateInfo } from '#domain/pantryItemDuplicate';
import { logger } from '#/utils/environment';

/**
 * Args passed UNDEFINED on purpose: the field is keyed on them, so client mode
 * stores `itemsConnection:{}`. Client mode only — see {@link scanCachedPantryItems}.
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

type CachedNode = {
  id: string;
  itemName: string | null;
  quantity: number | null;
  item: { id: string } | null;
};

/**
 * Every cached `itemsConnection` variant, whatever key. Reads the store direct:
 * server mode keys on the live filter and sort, which no fragment can name.
 */
function scanCachedPantryItems(
  cache: ApolloCache,
  pantryCacheId: string,
): CachedNode[] {
  let store;
  try {
    store = cache.extract() as Record<string, Record<string, unknown>>;
  } catch (error) {
    logger.warn(
      'Pantry duplicate pre-check could not extract the cache:',
      error,
    );
    return [];
  }

  const pantry = store[pantryCacheId];
  if (!pantry) return [];

  const nodes: CachedNode[] = [];
  for (const [field, value] of Object.entries(pantry)) {
    if (!field.startsWith('itemsConnection')) continue;
    const edges = (value as { edges?: unknown[] } | null)?.edges;
    if (!Array.isArray(edges)) continue;

    for (const edge of edges) {
      const ref = (edge as { node?: { __ref?: string } } | null)?.node?.__ref;
      const node = ref ? store[ref] : undefined;
      if (!node) continue;
      nodes.push({
        id: node.id as string,
        itemName: (node.itemName as string | null) ?? null,
        quantity: (node.quantity as number | null) ?? null,
        item: (node.item as { __ref?: string } | null)?.__ref
          ? { id: String((node.item as { __ref: string }).__ref).split(':')[1] }
          : null,
      });
    }
  }
  return nodes;
}

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
  // A miss on the client-mode key is not "no duplicate": in server mode the
  // field is keyed on the live filter and sort, so the rows are cached under a
  // key this fragment cannot name. Without this the same duplicate prompts on
  // a small pantry and not on a large one.
  const nodes: CachedNode[] = edges
    ? edges.flatMap(edge => (edge?.node ? [edge.node] : []))
    : scanCachedPantryItems(cache, pantryCacheId);

  for (const node of nodes) {
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
