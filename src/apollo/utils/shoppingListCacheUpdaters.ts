/**
 * Cache updaters for shopping list items, shared by mutations and subscriptions.
 * Apollo stores an ALIASED field under its real name with serialized keyArgs
 * (`itemsConnection:{"isPurchased":true}`), not under the alias — so every update
 * targets `itemsConnection` and tells variants apart by `storeFieldName`.
 */

import { gql, isReference, type ApolloCache } from '@apollo/client';
import { Kind, type DocumentNode, type FragmentDefinitionNode } from 'graphql';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import { ShoppingListCacheUpdaters_ListDetailFragmentDoc } from './shoppingListCacheUpdaters.generated';
import { NEUTRAL_SHOPPING_LIST_DETAIL } from './shoppingListDetailNeutral.generated';
import { createOptimisticEntity } from './createOptimisticResponse';
import { classifyCreateResult } from './classifyCreateResult';
import { errorService } from '#/services/errorService';
import {
  type AddToConnectionOptions,
  type ConnectionData,
  createAddToQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  safeEvict,
  safeEvictMany,
} from './cacheUpdaters';
import { logger } from '#/utils/environment';

export interface OptimisticShoppingListItemFields {
  /**
   * Required, not optional: the offline queue reads it back to build a
   * toggle/quantity/update replay, and a row written without it fails permanently.
   */
  shoppingListId: string;
  itemName: string;
  quantity?: number | null;
  quantityInput?: string | null;
  unitName?: string | null;
  category?: string | null;
  itemId?: string | null;
  unitId?: string | null;
}

/**
 * Build a complete optimistic `ShoppingListItem` for local-first creates. `id` is
 * the client-minted cuid (the row's PK), so the online create and the queued replay
 * converge on one row. The full display shape is mandatory offline — an incomplete
 * one makes a cell's `useFragment` report `complete: false` and blank the row.
 */
export function createOptimisticShoppingListItem(
  id: string,
  fields: OptimisticShoppingListItemFields,
): ShoppingListItemDisplayFragment {
  return createOptimisticEntity<ShoppingListItemDisplayFragment>(
    'ShoppingListItem',
    id,
    {
      shoppingList: {
        __typename: 'ShoppingList',
        id: fields.shoppingListId,
      },
      itemName: fields.itemName,
      quantity: fields.quantity ?? 1,
      quantityInput: fields.quantityInput ?? null,
      displayFormat: DisplayFormat.Auto,
      unitName: fields.unitName ?? null,
      category: fields.category ?? null,
      notes: null,
      sortOrder: '',
      // Built whole rather than through `writePurchaseInfo`, which patches an
      // existing record. A just-created line has no prior purchase to preserve.
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: false,
        // Present rather than omitted: the row reads it, and one absent field
        // makes the whole list read incomplete.
        movedToPantryAt: null,
      },
      item: fields.itemId
        ? { __typename: 'Item', id: fields.itemId, imageUrl: null, images: [] }
        : null,
      unit: fields.unitId
        ? { __typename: 'Unit', id: fields.unitId, name: '', symbol: '' }
        : null,
    },
  );
}

/**
 * Minimal stats read used by {@link addOptimisticShoppingListItem} to recompute
 * `remainingItems` / `completionRate` after an optimistic add.
 */
const ShoppingListStatsForOptimisticAddFragment = gql`
  fragment _ShoppingListStatsForOptimisticAdd on ShoppingList {
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

/** What a caller may change about a line's purchase record. */
export interface PurchaseInfoPatch {
  isPurchased?: boolean;
  movedToPantryAt?: string | null;
}

/**
 * The stamp a cached line already carries, or null — the read counterpart to
 * {@link writePurchaseInfo}, so a caller deciding whether to stamp a line never
 * reaches into the record itself.
 */
export function readMovedToPantryAt(
  cache: ApolloCache,
  itemId: string,
): string | null {
  const cacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: itemId,
  });
  if (!cacheId) return null;
  return (
    cache.readFragment<{ purchaseInfo?: { movedToPantryAt?: string | null } }>({
      id: cacheId,
      fragment: gql`
        fragment _MovedToPantryAt on ShoppingListItem {
          purchaseInfo {
            movedToPantryAt
          }
        }
      `,
      fragmentName: '_MovedToPantryAt',
    })?.purchaseInfo?.movedToPantryAt ?? null
  );
}

/**
 * Every field of `ShoppingListItemPurchaseInfo`; must stay complete against the
 * SDL, which `__tests__/graphql/purchaseInfoWriterCoversType.test.ts` enforces —
 * a field missing here is one a local write silently drops.
 */
const PURCHASE_INFO_FIELDS = `
      __typename
      isPurchased
      movedToPantryAt
      purchaseDate
      purchasedById
      purchasedPrice
      purchasedQuantity
      purchasedBy {
        __typename
        id
      }`;

/** The row's purchase record as this module reads and writes it. */
const PURCHASE_INFO_FRAGMENT = gql`
  fragment _WritePurchaseInfo on ShoppingListItem {
    __typename
    id
    purchaseInfo {${PURCHASE_INFO_FIELDS}
    }
  }
`;

const PURCHASE_INFO_WITH_UPDATED_AT_FRAGMENT = gql`
  fragment _WritePurchaseInfoWithUpdatedAt on ShoppingListItem {
    __typename
    id
    updatedAt
    purchaseInfo {${PURCHASE_INFO_FIELDS}
    }
  }
`;

/** The purchase record's own fields, as read from the cache. */
type CachedPurchaseInfo = Record<string, unknown> & {
  isPurchased?: boolean;
  movedToPantryAt?: string | null;
};

/**
 * The ONLY writer of `ShoppingListItem.purchaseInfo`. Its type policy CLEARS every
 * field a write omits whenever `isPurchased` changes, so a write asserting a flag
 * it does not own destroys the record; and `movedToPantryAt` is derived from the
 * flag, so a local flip must clear the stamp. Callers say only what they change.
 */
export function writePurchaseInfo(
  cache: ApolloCache,
  itemId: string,
  patch: PurchaseInfoPatch,
  options: { updatedAt?: string; restoring?: boolean } = {},
): void {
  const cacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: itemId,
  });
  if (!cacheId) return;

  const existing = cache.readFragment<{
    purchaseInfo?: CachedPurchaseInfo | null;
  }>({
    id: cacheId,
    fragment: PURCHASE_INFO_FRAGMENT,
    fragmentName: '_WritePurchaseInfo',
    returnPartialData: true,
  })?.purchaseInfo;

  // A value object with no key fields is never stored as a reference, but the
  // read's type admits one and spreading it would write `__ref` over the record.
  const cached: CachedPurchaseInfo | undefined = isReference(existing)
    ? undefined
    : existing ?? undefined;

  const wasPurchased = cached?.isPurchased ?? false;
  // Only a caller that names the flag may change it. Everything else leaves it
  // exactly as cached.
  const nextPurchased = patch.isPurchased ?? wasPurchased;
  const flipped = nextPurchased !== wasPurchased;

  const stamp = resolveStamp({
    patch,
    cached: cached?.movedToPantryAt ?? null,
    flipped,
    restoring: options.restoring === true,
  });

  // `writeFragment`, not `cache.modify`: modify runs no type-policy merge and
  // cannot introduce a field the record lacks. Every cached field is written back
  // explicitly, so the policy's clear-on-flip has nothing to clear on a LOCAL
  // write — the amounts belong to the purchase the server recorded.
  const purchaseInfo = {
    ...carriedForward(cached),
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: nextPurchased,
    movedToPantryAt: stamp,
  };

  // The fragment is narrowed to what is being written, not to what the type
  // has — see {@link purchaseInfoWriteFragment}.
  const written = purchaseInfoWriteFragment(
    Object.keys(purchaseInfo),
    options.updatedAt !== undefined,
  );

  cache.writeFragment({
    id: cacheId,
    fragment: written.doc,
    fragmentName: written.name,
    data: {
      __typename: 'ShoppingListItem',
      id: itemId,
      ...(options.updatedAt === undefined
        ? {}
        : { updatedAt: options.updatedAt }),
      purchaseInfo,
    },
  });
}

/**
 * The record's other fields, exactly as cached. A field the cache does not hold is
 * left OUT rather than written as null: the write must not invent a value, and an
 * absent key is one the policy has nothing to clear either.
 */
function carriedForward(
  cached: CachedPurchaseInfo | undefined,
): Record<string, unknown> {
  if (!cached) return {};
  const carried: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(cached)) {
    if (field === '__typename') continue;
    if (field === 'isPurchased' || field === 'movedToPantryAt') continue;
    if (value === undefined) continue;
    carried[field] = value;
  }
  return carried;
}

/**
 * The write fragment narrowed to exactly the fields a write supplies:
 * `writeFragment` reports every field its fragment SELECTS and the data OMITS, and
 * the record's cached shape is whatever the READING operation selected. The store
 * outcome is unchanged — Apollo drops a missing field BEFORE the merge runs.
 */
const purchaseInfoWriteDocs = new Map<
  string,
  { doc: DocumentNode; name: string }
>();

// Built by filtering the read fragment's AST rather than a second field list, so
// the two cannot drift. Each field set gets its own NAME: Apollo caches a parsed
// document by name, and two documents sharing one would serve each other's
// selections.
function purchaseInfoWriteFragment(
  fields: readonly string[],
  withUpdatedAt: boolean,
): { doc: DocumentNode; name: string } {
  const baseName = withUpdatedAt
    ? '_WritePurchaseInfoWithUpdatedAt'
    : '_WritePurchaseInfo';
  const kept = new Set(fields);
  const name = `${baseName}_${fields
    .filter(field => field !== '__typename')
    .sort()
    .join('_')}`;

  const memo = purchaseInfoWriteDocs.get(name);
  if (memo) return memo;

  const source = withUpdatedAt
    ? PURCHASE_INFO_WITH_UPDATED_AT_FRAGMENT
    : PURCHASE_INFO_FRAGMENT;
  const definition = source.definitions.find(
    (node): node is FragmentDefinitionNode =>
      node.kind === Kind.FRAGMENT_DEFINITION && node.name.value === baseName,
  );
  // The read fragment is a module-scope literal, so this cannot miss. Falling
  // back to it whole rather than throwing keeps a write correct if it ever did.
  if (!definition) return { doc: source, name: baseName };

  const built = {
    name,
    doc: {
      ...source,
      definitions: [
        {
          ...definition,
          name: { ...definition.name, value: name },
          selectionSet: {
            ...definition.selectionSet,
            selections: definition.selectionSet.selections.map(selection =>
              selection.kind === Kind.FIELD &&
              selection.name.value === 'purchaseInfo' &&
              selection.selectionSet
                ? {
                    ...selection,
                    selectionSet: {
                      ...selection.selectionSet,
                      selections: selection.selectionSet.selections.filter(
                        sub =>
                          sub.kind === Kind.FIELD &&
                          (sub.name.value === '__typename' ||
                            kept.has(sub.name.value)),
                      ),
                    },
                  }
                : selection,
            ),
          },
        },
      ],
    },
  };

  purchaseInfoWriteDocs.set(name, built);
  return built;
}

/**
 * The stamp a write should leave behind. Restoring is not flipping: a revert
 * re-asserts the flag the row had before the user touched it, which looks like a
 * flip from the cache's side. The server never saw the change, so it still holds
 * the stamp, and clearing it would re-offer a move-to-pantry already done.
 */
function resolveStamp({
  patch,
  cached,
  flipped,
  restoring,
}: {
  patch: PurchaseInfoPatch;
  cached: string | null;
  flipped: boolean;
  restoring: boolean;
}): string | null {
  if (restoring) {
    return patch.movedToPantryAt !== undefined ? patch.movedToPantryAt : cached;
  }
  if (flipped) return null;
  if (patch.movedToPantryAt !== undefined) return patch.movedToPantryAt;
  return cached;
}

/**
 * Does `storeFieldName`'s serialized keyArgs carry `key: value`? Apollo encodes
 * them as `itemsConnection:{"filters":{"isPurchased":true}}`.
 */
export function matchesFilter(
  storeFieldName: string,
  key: string,
  value: boolean,
): boolean {
  return storeFieldName.includes(`${key}":${value}`);
}

/** Shorthand: does this storeFieldName target the purchased variant? */
export function isPurchasedVariant(storeFieldName: string): boolean {
  return matchesFilter(storeFieldName, 'isPurchased', true);
}

/** Shorthand: does this storeFieldName target the unpurchased variant? */
export function isUnpurchasedVariant(storeFieldName: string): boolean {
  return matchesFilter(storeFieldName, 'isPurchased', false);
}

/** Remove an item from EVERY `ShoppingList.itemsConnection` variant — deletion. */
export const removeFromShoppingListItemsConnection =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );

/** Clear every item of one purchase status from the cache in a single write. */
function clearItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
  isPurchased: boolean,
): void {
  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });

  if (!parentCacheId) return;

  cache.modify({
    id: parentCacheId,
    fields: {
      itemsConnection(
        existing: ConnectionData | undefined,
        { storeFieldName },
      ) {
        if (
          !matchesFilter(storeFieldName, 'isPurchased', isPurchased) ||
          !existing
        )
          return existing;
        return {
          ...existing,
          edges: [],
          totalCount: 0,
        };
      },
      ...(isPurchased && {
        completedItems() {
          return 0;
        },
      }),
      totalItems(existing: number = 0) {
        return Math.max(0, existing - itemIds.length);
      },
    },
  });

  safeEvictMany(
    cache,
    itemIds.map(id => ({ typename: 'ShoppingListItem', id })),
  );
}

/** Clear ALL purchased items from cache. */
export function clearAllPurchasedItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
): void {
  clearItemsFromCache(cache, listId, itemIds, true);
}

/** Clear ALL unpurchased items from cache. */
export function clearAllUnpurchasedItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
): void {
  clearItemsFromCache(cache, listId, itemIds, false);
}

function updateItemsConnectionForPurchaseStatusChange(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  movingToPurchased: boolean,
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });

    if (!parentCacheId) return;

    // readField sees pre-modify values, so all three stat modifiers below derive
    // the new completedItems from the same baseline regardless of run order.
    const nextCompleted = (current: number) =>
      movingToPurchased ? current + 1 : Math.max(0, current - 1);

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName, toReference },
        ) {
          const isUnpurchasedConnection = isUnpurchasedVariant(storeFieldName);
          const isPurchasedConnection = isPurchasedVariant(storeFieldName);

          if (!existing?.edges) return existing;

          const removeItemEdges = () => ({
            ...existing,
            edges: existing.edges!.filter(
              edge => readField<string>('id', edge?.node) !== itemId,
            ),
            totalCount: Math.max(0, (existing.totalCount || 0) - 1),
          });

          const addItemEdge = () => {
            const alreadyExists = existing.edges!.some(
              edge => readField<string>('id', edge?.node) === itemId,
            );
            if (alreadyExists) return existing;
            const node = toReference({
              __typename: 'ShoppingListItem',
              id: itemId,
            });
            if (!node) return existing;
            const newEdge = {
              __typename: 'ShoppingListItemEdge',
              cursor: itemId,
              node,
            };
            return {
              ...existing,
              edges: [newEdge, ...existing.edges!],
              totalCount: (existing.totalCount || 0) + 1,
            };
          };

          if (movingToPurchased) {
            if (isUnpurchasedConnection) return removeItemEdges();
            if (isPurchasedConnection) return addItemEdge();
          } else {
            if (isPurchasedConnection) return removeItemEdges();
            if (isUnpurchasedConnection) return addItemEdge();
          }

          return existing;
        },
        completedItems(existing: number = 0) {
          return nextCompleted(existing);
        },
        // Keep the derived stats in sync with the new completedItems so the
        // progress header doesn't go stale until the next refetch.
        remainingItems(_existing: number, { readField }) {
          const total = readField<number>('totalItems') ?? 0;
          const completed = readField<number>('completedItems') ?? 0;
          return Math.max(0, total - nextCompleted(completed));
        },
        completionRate(_existing: number, { readField }) {
          const total = readField<number>('totalItems') ?? 0;
          const completed = readField<number>('completedItems') ?? 0;
          return total > 0 ? nextCompleted(completed) / total : 0;
        },
      },
    });
  } catch (error) {
    logger.warn(
      'Failed to update itemsConnection for purchase status change:',
      error,
    );
  }
}

/** Move a row to purchased, rewiring the filtered `itemsConnection` variants. */
export function moveShoppingListItemToPurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, true);
}

/** Move a row to unpurchased, rewiring the filtered `itemsConnection` variants. */
export function moveShoppingListItemToUnpurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, false);
}

/**
 * Add an item to a shopping list's cache. The `isPurchased:true` variant REMOVES
 * the row (re-adding a purchased item); every other variant adds it. Pass
 * `bumpTotalItems: false` when a local-first
 * {@link addOptimisticShoppingListItem} has already counted it.
 */
export function addNewItemToShoppingListCache(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
  bumpTotalItems = true,
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });
    if (!parentCacheId) return;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName, toReference },
        ) {
          if (!existing?.edges) return existing;

          if (isPurchasedVariant(storeFieldName)) {
            // Re-adding a purchased row: drop it from the purchased variant.
            const hadItem = existing.edges.some(
              edge => readField<string>('id', edge?.node) === item.id,
            );
            if (!hadItem) return existing;
            return {
              ...existing,
              edges: existing.edges.filter(
                edge => readField<string>('id', edge?.node) !== item.id,
              ),
              totalCount: Math.max(0, (existing.totalCount || 0) - 1),
            };
          }

          const alreadyExists = existing.edges.some(
            edge => readField<string>('id', edge?.node) === item.id,
          );
          if (alreadyExists) return existing;

          const node = toReference(
            { __typename: 'ShoppingListItem', id: item.id },
            true,
          );
          if (!node) return existing;
          const newEdge = {
            __typename: 'ShoppingListItemEdge',
            cursor: item.id,
            node,
          };
          return {
            ...existing,
            edges: [newEdge, ...existing.edges],
            totalCount: (existing.totalCount || 0) + 1,
          };
        },
        ...(bumpTotalItems && {
          totalItems(existing: number = 0) {
            return existing + 1;
          },
        }),
      },
    });
  } catch (error) {
    logger.warn('Failed to update cache for new shopping list item:', error);
  }
}

/**
 * Reconcile a local-first create from the mutation's `update`: adopt the server id
 * and re-wire the edge WITHOUT re-counting — the optimistic add already bumped
 * `totalItems`. `clientId` comes from the mutation's own `variables`, never a
 * shared ref, so overlapping adds stay correct.
 */
export function reconcileShoppingItemCreateUpdate(
  cache: ApolloCache,
  listId: string,
  serverItem: { id: string },
  clientId: string | null | undefined,
): void {
  adoptServerShoppingListItemId(cache, serverItem.id, clientId);
  addNewItemToShoppingListCache(cache, listId, serverItem, false);
}

// Structural slices the builder below reads, kept loose so every
// add-to-shopping-list mutation document satisfies the shape.
interface AddItemsReconcilePayloadLike {
  __typename?: string;
  results?: readonly ({ item?: { id: string } | null } | null)[] | null;
}

interface AddItemsReconcileDataLike {
  addItemsToShoppingList?: AddItemsReconcilePayloadLike | null;
}

interface AddItemsReconcileVariablesLike {
  input: {
    items?: readonly ({ id?: string | null } | null)[] | null;
    shoppingListId?: string | null;
  };
}

interface BuildAddItemsReconcileUpdateOptions {
  /** Target list id; when omitted, read from `variables.input.shoppingListId`. */
  listId?: string | null;
  /**
   * When set, run the reconcile inside a try/catch reporting this failure
   * message and optional refetch fallback. Omit to apply the reconcile directly.
   */
  wrap?: { message: string; refetch?: () => void };
}

/**
 * The mutation `update` shared by every add-to-shopping-list entry point: guard the
 * payload, take the single created/merged row, adopt the server id, reconcile into
 * the list. List id from `listId`, else `variables.input.shoppingListId`.
 */
export function buildAddItemsReconcileUpdate({
  listId,
  wrap,
}: BuildAddItemsReconcileUpdateOptions) {
  return (
    cache: ApolloCache,
    { data }: { data?: AddItemsReconcileDataLike | null },
    { variables }: { variables?: AddItemsReconcileVariablesLike },
  ): void => {
    const payload = data?.addItemsToShoppingList;
    const targetListId = listId ?? variables?.input.shoppingListId;
    if (
      payload?.__typename !== 'AddItemsToShoppingListPayload' ||
      !targetListId ||
      !variables
    ) {
      return;
    }
    // Single add via the batch mutation — the created/merged row is the one
    // entry in `results`. Null when that item failed.
    const item = payload.results?.[0]?.item;
    if (!item) return;
    const clientId = variables.input.items?.[0]?.id;
    const run = () =>
      reconcileShoppingItemCreateUpdate(cache, targetListId, item, clientId);
    if (wrap) {
      try {
        run();
      } catch (cacheError) {
        errorService.reportError(cacheError, { operation: wrap.message });
        wrap.refetch?.();
      }
    } else {
      run();
    }
  };
}

/**
 * Local-first optimistic add: writes the FULL display entity, the connection edge
 * and recomputed stats PERMANENTLY before the create fires, so it survives a
 * fully-offline create (the queue replays `SyncShoppingListItem(clientId = id)`).
 * `item.id` MUST be the client-minted cuid sent as `input.id`, or the replay dupes.
 */
export function addOptimisticShoppingListItem(
  cache: ApolloCache,
  listId: string,
  item: ShoppingListItemDisplayFragment,
): void {
  // 1. Full entity, so the bare-ref edge resolves with display fields offline.
  cache.writeFragment({
    id: cache.identify(item),
    fragment: ShoppingListItemDisplayFragmentDoc,
    fragmentName: 'ShoppingListItemDisplayFragment',
    data: item,
  });

  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });

  // 2. Snapshot completedItems BEFORE the add — a new row is unpurchased, so it
  //    is unchanged, and remaining/completion derive from it.
  const stats = parentCacheId
    ? cache.readFragment<{ completedItems: number }>({
        id: parentCacheId,
        fragment: ShoppingListStatsForOptimisticAddFragment,
        fragmentName: '_ShoppingListStatsForOptimisticAdd',
      })
    : null;
  const completed = stats?.completedItems ?? 0;

  // 3. Add the edge + bump totalItems.
  addNewItemToShoppingListCache(cache, listId, item);

  // 4. Recompute remaining / completion from the now-bumped total.
  if (!parentCacheId) return;
  cache.modify({
    id: parentCacheId,
    fields: {
      remainingItems(_existing: number, { readField }) {
        const total = readField<number>('totalItems') ?? 0;
        return Math.max(0, total - completed);
      },
      completionRate(_existing: number, { readField }) {
        const total = readField<number>('totalItems') ?? 0;
        return total > 0 ? completed / total : 0;
      },
    },
  });
}

/**
 * Reverse {@link addOptimisticShoppingListItem} on a rejected create. Evicting the
 * entity alone is NOT enough: the optimistic add also bumped `totalItems` /
 * `remainingItems` / `completionRate`, and the self-healing `itemsConnection` read
 * repairs only its own `totalCount`. That read drops the dangling edge.
 */
export function revertOptimisticShoppingListItem(
  cache: ApolloCache,
  listId: string,
  clientId: string,
): void {
  safeEvict(cache, 'ShoppingListItem', clientId);

  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });
  if (!parentCacheId) return;

  const stats = cache.readFragment<{
    totalItems: number;
    completedItems: number;
  }>({
    id: parentCacheId,
    fragment: ShoppingListStatsForOptimisticAddFragment,
    fragmentName: '_ShoppingListStatsForOptimisticAdd',
  });
  const newTotal = Math.max(0, (stats?.totalItems ?? 0) - 1);
  const completed = stats?.completedItems ?? 0;

  cache.modify({
    id: parentCacheId,
    fields: {
      totalItems: () => newTotal,
      remainingItems: () => Math.max(0, newTotal - completed),
      completionRate: () => (newTotal > 0 ? completed / newTotal : 0),
    },
  });
}

/**
 * Reconcile a local-first item create once the mutation resolves: `'rejected'`
 * discards the optimistic row, `'created'` / `'queued'` keep it — a queued create
 * replays later, keyed by the same `id`. Returns which happened, so the caller can
 * drive its own success / error UX.
 */
export function reconcileShoppingCreate(
  cache: ApolloCache,
  listId: string,
  optimisticId: string,
  result: { data?: unknown; error?: unknown } | null | undefined,
): 'kept' | 'reverted' {
  const outcome = classifyCreateResult(result);
  // The batch can resolve successfully while its single item fails
  // (`results[0].success === false` — a per-item validation error reported inside
  // the batch rather than as a top-level error member). Revert that too.
  const payload = (
    result as
      | {
          data?: {
            addItemsToShoppingList?: {
              __typename?: string;
              results?: Array<{ success: boolean }>;
            };
          };
        }
      | null
      | undefined
  )?.data?.addItemsToShoppingList;
  const itemFailed =
    payload?.__typename === 'AddItemsToShoppingListPayload' &&
    payload.results?.[0]?.success === false;
  if (outcome === 'rejected' || itemFailed) {
    try {
      revertOptimisticShoppingListItem(cache, listId, optimisticId);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Shopping List Item',
      });
    }
    return 'reverted';
  }
  return 'kept';
}

/**
 * Catalog merge: when the server resolves the create to an EXISTING row, evict the
 * stale client cuid so its dangling edge is dropped by the self-healing read and
 * the server row stands. `clientId` comes off the mutation's own `variables`, never
 * a shared ref. A no-op when the server echoed the same id.
 */
export function adoptServerShoppingListItemId(
  cache: ApolloCache,
  serverId: string,
  clientId: string | null | undefined,
): void {
  if (clientId && serverId !== clientId) {
    safeEvict(cache, 'ShoppingListItem', clientId);
  }
}

/**
 * What {@link restoreItemToShoppingListAfterMoveToPantry} needs at withdrawal time:
 * which list, and which filtered variant of its connection.
 */
const RESTORE_MOVED_ITEM_FRAGMENT = gql`
  fragment RestoreMovedShoppingListItem on ShoppingListItem {
    id
    purchaseInfo {
      isPurchased
    }
    shoppingList {
      id
    }
  }
`;

/**
 * Remove one item when moving it to the pantry. Unlike the generic remover this
 * touches ONLY the matching purchased/unpurchased variant, so the other tab's
 * `totalCount` is not decremented, and it updates `completedItems`/`totalItems`.
 */
export function removeItemFromShoppingListForMoveToPantry(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  wasPurchased: boolean,
  options: { evictEntity?: boolean } = {},
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });

    if (!parentCacheId) return;

    // The edge write first, recording whether it changed anything; the counters
    // follow from that. This helper runs TWICE for one online move (eager unlink,
    // then the update callback) and `edges.filter` is idempotent while `-1` is not.
    // Two passes because `cache.modify` visits fields in the STORE's order.
    let removed = false;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName },
        ) {
          if (
            !matchesFilter(storeFieldName, 'isPurchased', wasPurchased) ||
            !existing?.edges
          )
            return existing;

          const edges = existing.edges.filter(
            edge => readField<string>('id', edge?.node) !== itemId,
          );
          if (edges.length === existing.edges.length) return existing;

          removed = true;
          return {
            ...existing,
            edges,
            totalCount: Math.max(0, (existing.totalCount || 0) - 1),
          };
        },
      },
    });

    if (removed) {
      cache.modify({
        id: parentCacheId,
        fields: {
          ...(wasPurchased && {
            completedItems(existing: number = 0) {
              return Math.max(0, existing - 1);
            },
          }),
          totalItems(existing: number = 0) {
            return Math.max(0, existing - 1);
          },
        },
      });
    }

    // Evicting is for the CONFIRMED move. The eager (pre-fire) call keeps the
    // entity, because a permanently-refused replay must put the row back and there
    // is no snapshot to rebuild it from.
    if (options.evictEntity !== false) {
      safeEvict(cache, 'ShoppingListItem', itemId);
    }
  } catch (error) {
    logger.warn(
      'Failed to remove item from ShoppingList for move to pantry:',
      error,
    );
  }
}

/**
 * Put a shopping row back after a move to the pantry is permanently refused —
 * without it the item is in neither list. Reads the list id and purchase state from
 * the still-cached entity rather than arguments: the withdrawal runs long after the
 * call site is gone. A no-op when the entity is gone.
 */
export function restoreItemToShoppingListAfterMoveToPantry(
  cache: ApolloCache,
  itemId: string,
): void {
  try {
    const itemCacheId = cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (!itemCacheId) return;

    const row = cache.readFragment<{
      id: string;
      purchaseInfo: { isPurchased: boolean } | null;
      shoppingList: { id: string } | null;
    }>({
      id: itemCacheId,
      fragment: RESTORE_MOVED_ITEM_FRAGMENT,
    });

    const listId = row?.shoppingList?.id;
    if (!row || !listId) return;

    const wasPurchased = Boolean(row.purchaseInfo?.isPurchased);
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });
    if (!parentCacheId) return;

    // Same two-pass shape as the remove: the counters follow the edge insert
    // rather than assuming it, since this runs from the withdrawal AND the revert.
    let restored = false;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName, toReference },
        ) {
          if (
            !matchesFilter(storeFieldName, 'isPurchased', wasPurchased) ||
            !existing?.edges
          )
            return existing;

          // Idempotent: a withdrawal that runs twice must not duplicate the row.
          const alreadyThere = existing.edges.some(
            edge => readField<string>('id', edge?.node) === itemId,
          );
          if (alreadyThere) return existing;

          const node = toReference({
            __typename: 'ShoppingListItem',
            id: itemId,
          });
          if (!node) return existing;

          restored = true;
          return {
            ...existing,
            edges: [
              ...existing.edges,
              { __typename: 'ShoppingListItemEdge', cursor: itemId, node },
            ],
            totalCount: (existing.totalCount || 0) + 1,
          };
        },
      },
    });

    if (restored) {
      cache.modify({
        id: parentCacheId,
        fields: {
          ...(wasPurchased && {
            completedItems(existing: number = 0) {
              return existing + 1;
            },
          }),
          totalItems(existing: number = 0) {
            return existing + 1;
          },
        },
      });
    }
  } catch (error) {
    logger.warn(
      'Failed to restore item to ShoppingList after refused move to pantry:',
      error,
    );
  }
}

/**
 * Display shape of the optimistic `ShoppingList`, mirroring what the overview query
 * `GetShoppingListsLite` selects per node so it reads complete from cache offline.
 */
export type OptimisticShoppingList = {
  __typename: 'ShoppingList';
  id: string;
  version: number;
  updatedAt: string;
  name: string;
  isDefault: boolean;
  totalItems: number;
  completedItems: number;
  remainingItems: number;
  completionRate: number;
  homeId: string | null;
  home: { __typename: 'Home'; id: string; name: string } | null;
  ownerships: Array<{
    __typename: 'ShoppingListOwnership';
    id: string;
    userId: string;
    user: OptimisticShoppingListUser;
  }>;
};

type OptimisticShoppingListUser = {
  __typename: 'User';
  id: string;
  // Nullable per the schema: `User.email` resolves only for the caller's own
  // record. Populated here (the row is always the creator's), but the shape must
  // match what the server write-through carries or the entity type-mismatches.
  email: string | null;
  profile: {
    __typename: 'UserProfile';
    id: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
};

/** Entity write shape for {@link addOptimisticShoppingList}. */
const OptimisticShoppingListFragment = gql`
  fragment _OptimisticShoppingList on ShoppingList {
    id
    name
    isDefault
    totalItems
    completedItems
    remainingItems
    completionRate
    homeId
    version
    updatedAt
    home {
      id
      name
    }
    ownerships {
      id
      userId
      user {
        id
        email
        profile {
          id
          displayName
          avatar
        }
      }
    }
  }
`;

/** Owner display data read from the cache's canonical `User` entity. */
const OptimisticListOwnerUserFragment = gql`
  fragment _OptimisticListOwnerUser on User {
    id
    email
    profile {
      id
      displayName
      avatar
    }
  }
`;

/** Linked-home name read for the overview card's home chip. */
const OptimisticListHomeFragment = gql`
  fragment _OptimisticListHome on Home {
    id
    name
  }
`;

/**
 * One filtered `itemsConnection` variant, addressed by the same
 * `filters: { isPurchased }` keyArgs the items screen queries with.
 */
const ShoppingListEmptyItemsVariantFragment = gql`
  fragment _ShoppingListEmptyItemsVariant on ShoppingList {
    itemsConnection(filters: { isPurchased: $isPurchased }) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
      }
    }
  }
`;

const addToShoppingListsQueryCache = createAddToQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);

/**
 * A created list is never a template, so the `filters: { isTemplate: true }` variant
 * must not take it: that variant selects `templateName`, which an optimistic list
 * lacks, and one edge missing it makes the whole picker query read incomplete.
 */
const isTemplateListVariant = (storeFieldName: string) =>
  matchesFilter(storeFieldName, 'isTemplate', true);

/**
 * Adds a list to `Query.shoppingLists` (every cached filter variant except the
 * templates-only one).
 */
export const addShoppingListToQueryCache = (
  cache: ApolloCache,
  list: { id: string },
  options: AddToConnectionOptions = {},
): boolean =>
  addToShoppingListsQueryCache(cache, list, {
    ...options,
    skipStoreField: isTemplateListVariant,
  });

const removeShoppingListFromQueryCache = createRemoveFromQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);

/**
 * Build a complete optimistic `ShoppingList`. `id` is the client-minted cuid sent as
 * `input.id`, so create and replay converge on one row. Owner data comes from the
 * cached `User`; an incomplete copy falls back to the auth identity with a `null`
 * profile rather than clobbering cached fields. The home chip degrades to null.
 */
export function buildOptimisticShoppingList(
  cache: ApolloCache,
  id: string,
  input: { name: string; isDefault?: boolean | null; homeId?: string | null },
  owner: { id: string; email?: string | null },
): OptimisticShoppingList {
  const userCacheId = cache.identify({ __typename: 'User', id: owner.id });
  const cachedUser = userCacheId
    ? cache.readFragment<OptimisticShoppingListUser>({
        id: userCacheId,
        fragment: OptimisticListOwnerUserFragment,
        fragmentName: '_OptimisticListOwnerUser',
      })
    : null;
  const user: OptimisticShoppingListUser = cachedUser ?? {
    __typename: 'User',
    id: owner.id,
    email: owner.email ?? null,
    profile: null,
  };

  const homeId = input.homeId ?? null;
  const homeCacheId = homeId
    ? cache.identify({ __typename: 'Home', id: homeId })
    : undefined;
  const home = homeCacheId
    ? cache.readFragment<{ __typename: 'Home'; id: string; name: string }>({
        id: homeCacheId,
        fragment: OptimisticListHomeFragment,
        fragmentName: '_OptimisticListHome',
      })
    : null;

  return createOptimisticEntity<OptimisticShoppingList>('ShoppingList', id, {
    name: input.name,
    isDefault: input.isDefault ?? false,
    totalItems: 0,
    completedItems: 0,
    remainingItems: 0,
    completionRate: 0,
    homeId,
    home,
    ownerships: [
      {
        __typename: 'ShoppingListOwnership',
        // Client-only placeholder row: the server creates its own ownership
        // row, and the first write-through replaces this array (the orphaned
        // entity is gc'd later).
        id: `${id}:owner`,
        userId: owner.id,
        user,
      },
    ],
  });
}

/**
 * Local-first optimistic add of the LIST: full entity, both empty filtered
 * `itemsConnection` variants and the overview edge, written PERMANENTLY before the
 * create fires. Seeding the variants is what makes it usable offline — a
 * `cache.modify` modifier never creates a missing variant. `isDefault` is server-resolved.
 */
export function addOptimisticShoppingList(
  cache: ApolloCache,
  list: OptimisticShoppingList,
): void {
  // 1. Full entity write — mandatory offline, where no response ever arrives
  //    to materialize the row.
  cache.writeFragment({
    id: cache.identify(list),
    fragment: OptimisticShoppingListFragment,
    fragmentName: '_OptimisticShoppingList',
    data: list,
  });

  // 2. Seed both filtered itemsConnection variants as authoritatively empty.
  for (const isPurchased of [false, true]) {
    cache.writeFragment({
      id: cache.identify(list),
      fragment: ShoppingListEmptyItemsVariantFragment,
      fragmentName: '_ShoppingListEmptyItemsVariant',
      variables: { isPurchased },
      data: {
        itemsConnection: {
          __typename: 'ShoppingListItemConnection',
          totalCount: 0,
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          edges: [],
        },
      },
    });
  }

  // 3. Detail-shape the same entity so opening the list offline renders from
  //    cache instead of a wire read the server cannot answer yet.
  cache.writeFragment({
    id: cache.identify(list),
    fragment: ShoppingListCacheUpdaters_ListDetailFragmentDoc,
    fragmentName: 'shoppingListCacheUpdaters_listDetail',
    data: {
      // Neutral base derived from the SDL (scripts/generate-optimistic-fillers.mjs)
      // so a field added to the fragment cannot be forgotten here — that omission
      // is invisible until the detail screen blanks offline.
      ...NEUTRAL_SHOPPING_LIST_DETAIL,
      id: list.id,
    },
  });

  // 4. Edge into the lists overview (every cached filter variant).
  addShoppingListToQueryCache(cache, list);
}

/**
 * Remove a list entirely: `Query.shoppingLists` has no dangling-edge read filter
 * (unlike `itemsConnection`), so the edge is filtered and `totalCount` decremented
 * explicitly before the entity is evicted. Also the local-first list delete.
 */
export function removeShoppingListFromCache(
  cache: ApolloCache,
  listId: string,
): void {
  removeShoppingListFromQueryCache(cache, listId, { evictItem: false });
  safeEvict(cache, 'ShoppingList', listId);
}

/** Reverse {@link addOptimisticShoppingList} when the create is rejected. */
export function revertOptimisticShoppingList(
  cache: ApolloCache,
  listId: string,
): void {
  removeShoppingListFromCache(cache, listId);
}

/**
 * Snapshot a list's display shape before a local-first delete so a rejection can
 * restore it via {@link addOptimisticShoppingList}. Null when the cache copy is
 * incomplete — the caller then relies on the next overview refetch.
 */
export function readShoppingListSnapshot(
  cache: ApolloCache,
  listId: string,
): OptimisticShoppingList | null {
  const cacheId = cache.identify({ __typename: 'ShoppingList', id: listId });
  if (!cacheId) return null;
  return cache.readFragment<OptimisticShoppingList>({
    id: cacheId,
    fragment: OptimisticShoppingListFragment,
    fragmentName: '_OptimisticShoppingList',
  });
}

/**
 * Reconcile a local-first list create: the keep/revert rule of
 * {@link reconcileShoppingCreate} — `'rejected'` discards, `'created'`/`'queued'`
 * keep, a queued create replaying later keyed by the same `id`.
 */
export function reconcileShoppingListCreate(
  cache: ApolloCache,
  optimisticId: string,
  result: { data?: unknown; error?: unknown } | null | undefined,
): 'kept' | 'reverted' {
  const outcome = classifyCreateResult(result);
  if (outcome === 'rejected') {
    try {
      revertOptimisticShoppingList(cache, optimisticId);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Shopping List',
      });
    }
    return 'reverted';
  }
  return 'kept';
}
