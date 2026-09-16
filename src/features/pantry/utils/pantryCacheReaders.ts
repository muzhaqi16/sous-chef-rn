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
          unit {
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
        unit: { id: string } | null;
      } | null;
    } | null)[];
  } | null;
}

/** The matched row, plus what an optimistic restock needs to bump it locally. */
export interface CachedPantryItemDuplicate extends PantryItemDuplicateInfo {
  quantity: number | null;
}

const isStoreRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeName = (name: string | null | undefined): string =>
  (name ?? '').trim().toLowerCase();

/** `{ __ref: 'Item:abc' }` → `{ id: 'abc' }`; anything else is uncached. */
const refId = (value: unknown): { id: string } | null => {
  const ref = (value as { __ref?: string } | null)?.__ref;
  return ref ? { id: ref.split(':')[1] ?? '' } : null;
};

type CachedNode = {
  id: string;
  itemName: string | null;
  quantity: number | null;
  item: { id: string } | null;
  unit: { id: string } | null;
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
    store = cache.extract();
  } catch (error) {
    logger.warn(
      'Pantry duplicate pre-check could not extract the cache:',
      error,
    );
    return [];
  }
  if (!isStoreRecord(store)) return [];

  const pantry = store[pantryCacheId];
  if (!isStoreRecord(pantry)) return [];

  const nodes: CachedNode[] = [];
  for (const [field, value] of Object.entries(pantry)) {
    if (!field.startsWith('itemsConnection')) continue;
    const edges = (value as { edges?: unknown[] } | null)?.edges;
    if (!Array.isArray(edges)) continue;

    for (const edge of edges) {
      const ref = (edge as { node?: { __ref?: string } } | null)?.node?.__ref;
      const node = ref ? store[ref] : undefined;
      if (!isStoreRecord(node)) continue;
      nodes.push({
        id: node.id as string,
        itemName: (node.itemName as string | null) ?? null,
        quantity: (node.quantity as number | null) ?? null,
        item: refId(node.item),
        unit: refId(node.unit),
      });
    }
  }
  return nodes;
}

/**
 * The server's key is `(pantryId, itemId, unitId)` among active rows. `itemId`
 * reproduces the item half; `itemName` is the fallback for the details form,
 * which has no catalog id, and a name match only ever drives a prompt. Without
 * a `unitId` any unit matches, which reads "stocks this item at all".
 */
export function findCachedPantryItemDuplicate(
  cache: ApolloCache,
  pantryId: string | null | undefined,
  match: {
    itemId?: string | null;
    itemName?: string | null;
    unitId?: string | null;
  },
): CachedPantryItemDuplicate | null {
  if (!pantryId) return null;

  const itemId = match.itemId ?? null;
  const unitId = match.unitId ?? null;
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
    if (matched && (!unitId || node.unit?.id === unitId)) {
      return {
        existingPantryItemId: node.id,
        existingPantryItemIds: [node.id],
        quantity: node.quantity,
      };
    }
  }

  return null;
}
