/**
 * Shopping List Cache Updaters
 *
 * Reusable cache update utilities for shopping list items.
 * Used by both mutations and subscriptions to ensure consistent cache updates
 * when items move between purchased/unpurchased states.
 *
 * Apollo stores aliased fields under the actual field name with serialized
 * keyArgs (e.g. `itemsConnection:{"isPurchased":true}`), NOT under the alias
 * name. All cache updates therefore target `itemsConnection` and use
 * `storeFieldName` to distinguish filtered variants.
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
   * The list this row belongs to. Required, not optional: it is what the
   * offline queue reads back to build a toggle/quantity/update replay, and a
   * row written without it makes that replay fail permanently — so the type
   * forces every caller to supply it rather than letting one forget.
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
 * Build a complete optimistic `ShoppingListItem` for local-first creates.
 *
 * `id` is the client-minted cuid (the row's real PK), baked straight into the
 * entity so the online create and the queued replay converge on one row. The
 * full display shape is mandatory offline, where no server response arrives to
 * materialize the row (an incomplete shape makes a list cell's `useFragment`
 * report `complete: false` and blank the row). Pass the result to
 * {@link addOptimisticShoppingListItem}.
 *
 * Lives here (a shared apollo util) rather than inside the shoppingList feature
 * so every add surface — including ones in other features (barcode,
 * pantry-detail, filtered-pantry) — can build the same entity without crossing
 * a feature boundary.
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
      // Builds the record whole rather than going through `writePurchaseInfo`,
      // which patches an existing one. A line that was just created has no
      // prior purchase to preserve and no flag to flip.
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: false,
        // A line that was just created has not been purchased, so it cannot
        // have reached the pantry. Present rather than omitted because the row
        // reads it, and one absent field makes the whole list read incomplete.
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

// =============================================================================
// storeFieldName filter detection
// =============================================================================

/**
 * Check whether an Apollo `storeFieldName` matches a specific filter value.
 *
 * Apollo serializes `keyArgs` into storeFieldName, e.g.:
 *   `itemsConnection:{"filters":{"isPurchased":true}}`
 *
 * This helper avoids brittle `.includes()` string matching by encoding the
 * expected JSON fragment consistently.
 *
 * @example
 * matchesFilter(storeFieldName, 'isPurchased', true)
 * matchesFilter(storeFieldName, 'isPurchased', false)
 */
/** What a caller may change about a line's purchase record. */
export interface PurchaseInfoPatch {
  isPurchased?: boolean;
  movedToPantryAt?: string | null;
}

/**
 * The stamp a cached line already carries, or null.
 *
 * The counterpart to the writer above, here for the same reason: a caller
 * deciding whether to stamp a line has to know whether it is already stamped,
 * and reaching into the record from outside this module is how the two drift.
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
 * Every field of `ShoppingListItemPurchaseInfo`.
 *
 * Must stay complete against the SDL type, which
 * `__tests__/graphql/purchaseInfoWriterCoversType.test.ts` enforces — a field
 * missing here is a field a local write silently drops, for the reason in
 * {@link writePurchaseInfo}.
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
 * The only writer of `ShoppingListItem.purchaseInfo`.
 *
 * The record has two properties no call site should have to remember.
 *
 * Its type policy CLEARS every field a write omits whenever `isPurchased`
 * changes — deliberately, because inheriting a previous purchase's amounts
 * beside a new flag once showed a collaborator's name and price on someone
 * else's purchase. A write that asserts a flag it does not own can therefore
 * destroy the record: asserting `isPurchased: true` over a cached `false`
 * cleared the quantity, price, date and purchaser.
 *
 * And `movedToPantryAt` is derived from the flag: the server clears the stamp
 * on exactly the transition that ends a purchase cycle, so a local write that
 * flips the flag must clear it too. Otherwise a re-purchased line keeps a stamp
 * saying it is already stocked, and its row withholds the move-to-pantry action
 * for a line the bulk move will act on.
 *
 * Both rules live here so a sixth writer cannot drift from them. Callers say
 * what they are changing; they do not restate the rules.
 *
 * **Goes through `writeFragment`, not `cache.modify`.** `cache.modify` does not
 * run type-policy merges and cannot introduce a field the cached record does
 * not already carry, so the rules above were being asserted by a mechanism that
 * could not enforce either of them. `writeFragment` runs the policy.
 *
 * **And it carries the cached record forward.** The policy's clearing exists for
 * a narrow SERVER response, which describes a different purchase and must not
 * inherit the last one's amounts. A LOCAL flip is not that: the SDL documents a
 * clearing contract for `movedToPantryAt` alone, and the amounts belong to the
 * purchase the server recorded and are not this write's to discard. So every
 * field the record already holds is written back explicitly, leaving the policy
 * nothing to clear — the mechanism is honest, and the outcome is the one the
 * schema describes.
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
 * The record's other fields, exactly as cached.
 *
 * A field the cache does not hold is left OUT rather than written as null: the
 * write must not invent a value, and a key absent from both sides is one the
 * policy has nothing to clear either.
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
 * The write fragment narrowed to exactly the fields a write supplies.
 *
 * `writeFragment` reports every field its fragment SELECTS and the data OMITS.
 * Normally that is a defect: an operation asked for a field the payload does
 * not carry, and the read it feeds goes incomplete. Here it was neither. The
 * record's cached shape is whatever the READING operation selected,
 * {@link carriedForward} passes exactly that through, and the store ends up
 * right. What was wrong was the assertion — the writer named the whole type
 * while supplying the part of it the cache holds, so every toggle from the list
 * screen reported five missing fields. That screen's
 * `ShoppingListItemDisplayFragment` caches `isPurchased` and `movedToPantryAt`
 * and nothing else, which is the correct thing for it to cache.
 *
 * The console noise was the cheap half. The expensive half was that the
 * suite-wide missing-field guard had to be taught to ignore those five pairs,
 * and a hole cut in a guard is open to whatever else falls through it.
 *
 * So the fragment narrows to the write instead. The store outcome is unchanged,
 * the type policy included: Apollo drops a field the data lacks BEFORE the
 * merge runs, so `incoming` — which is what the clear-on-flip loop in
 * `cache.ts` tests with `field in incoming` — is identical either way.
 *
 * Built by filtering the read fragment's AST rather than from a second field
 * list, so the two cannot drift. Each field set gets its own fragment NAME:
 * Apollo caches a parsed document by name, and two documents sharing one would
 * serve each other's selections. Memoized, since a toggle rebuilds this on
 * every tap and there are two shapes in practice.
 */
const purchaseInfoWriteDocs = new Map<
  string,
  { doc: DocumentNode; name: string }
>();

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
 * The stamp a write should leave behind.
 *
 * Restoring is not flipping. A revert re-asserts the flag the row had before
 * the user touched it, which looks like a flip from the cache's side and is
 * not one: the server never saw the change, so it still holds the stamp. Left
 * as a flip, the revert cleared a stamp the snapshot had no way to restore —
 * the row then re-offered move-to-pantry and a bulk move sent the line to the
 * pantry a second time.
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

/**
 * Remove item from ShoppingList.itemsConnection (all variants).
 * Correct for deletion — runs on every storeFieldName variant.
 */
export const removeFromShoppingListItemsConnection =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );

/**
 * Clear ALL items of a given purchase status from cache in a single atomic operation.
 * Used by "Clear All" buttons for instant UI feedback.
 *
 * @param cache - Apollo cache instance
 * @param listId - Shopping list ID
 * @param itemIds - Array of item IDs being cleared
 * @param isPurchased - Whether clearing purchased (true) or unpurchased (false) items
 */
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

  // Evict all deleted items from cache
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

/**
 * Helper to update itemsConnection filtered variants when purchase status changes
 */
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
          // Detect which filtered variant this is by checking storeFieldName
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
            // Moving to purchased: remove from unpurchased, add to purchased
            if (isUnpurchasedConnection) return removeItemEdges();
            if (isPurchasedConnection) return addItemEdge();
          } else {
            // Moving to unpurchased: remove from purchased, add to unpurchased
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

/**
 * Move a shopping list item to purchased state.
 * Updates itemsConnection filtered variants via storeFieldName detection.
 */
export function moveShoppingListItemToPurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, true);
}

/**
 * Move a shopping list item to unpurchased state.
 * Updates itemsConnection filtered variants via storeFieldName detection.
 */
export function moveShoppingListItemToUnpurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, false);
}

/**
 * Add a new item to shopping list cache.
 *
 * Uses storeFieldName detection to correctly update filtered itemsConnection variants:
 * - isPurchased:true variant → REMOVE the item (handles re-add of previously purchased item)
 * - All other variants (unfiltered, isPurchased:false) → ADD the item
 *
 * Pass `bumpTotalItems: false` when running after a local-first
 * {@link addOptimisticShoppingListItem} already counted the item — see
 * {@link reconcileShoppingItemCreateUpdate}.
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
            // REMOVE from purchased variant (handles re-add of previously purchased item)
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

          // ADD to unfiltered and unpurchased variants
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
 * Reconcile a local-first item create's server response from the mutation's
 * `update` callback: adopt the server id (evicting the optimistic cuid on a
 * catalog-merge) and re-wire the edge without re-counting — the optimistic add
 * already bumped `totalItems`. Pass `clientId` from the mutation's own
 * `variables` (never a shared ref) so it stays correct when adds overlap.
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

// Structural slices of the add-items mutation result/variables the builder
// below reads. Kept loose so every add-to-shopping-list mutation document
// (plain, from-pantry-item, from-filtered-pantry) satisfies the shape.
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
 * Builds the mutation `update` callback shared by every add-to-shopping-list
 * entry point: guard the `AddItemsToShoppingListPayload`, take the single
 * created/merged row, adopt the server id over the client id, and reconcile it
 * into the target list's cache. The list id comes from `listId` when supplied,
 * otherwise from the mutation's own `variables.input.shoppingListId`.
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
 * Local-first optimistic add: write a new ShoppingListItem to the cache
 * PERMANENTLY (full entity + connection edge + recomputed list stats) BEFORE the
 * create mutation fires, so it survives a fully-offline / API-down create (the
 * queue replays via `SyncShoppingListItem(clientId = id)`).
 *
 * Unlike {@link addNewItemToShoppingListCache} — which only wires a bare-ref
 * edge and relies on the mutation *response* to materialize the entity — this
 * `writeFragment`s the full display entity first. That step is mandatory
 * offline, where no response ever arrives to fill the entity's fields (without
 * it the row renders blank).
 *
 * `item.id` MUST be the client-minted cuid sent as `input.id`, so the online
 * create and the queued replay converge on the same row (no duplicate).
 */
export function addOptimisticShoppingListItem(
  cache: ApolloCache,
  listId: string,
  item: ShoppingListItemDisplayFragment,
): void {
  // 1. Write the full entity so the (bare-ref) edge resolves with display
  //    fields even fully offline.
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

  // 2. Snapshot completedItems BEFORE the add (new items are unpurchased, so
  //    completedItems is unchanged; remaining/completion derive from it).
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
 * Reverse {@link addOptimisticShoppingListItem} when a local-first create is
 * rejected by the server (e.g. `ValidationError` / `ConflictError`).
 *
 * Evicting the entity alone is NOT a full revert: `addOptimisticShoppingListItem`
 * also bumped the `ShoppingList.totalItems` / `remainingItems` / `completionRate`
 * scalars, and the self-healing `itemsConnection` read only repairs the
 * connection's own `totalCount` — not those sibling scalars. So an evict-only
 * revert leaves the list header showing an inflated count until the next stats
 * refetch. This reverses the scalar bump too (the item was unpurchased, so
 * `completedItems` is unchanged). The dangling connection edge is dropped by the
 * self-healing read.
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
 * Reconcile a local-first shopping-list create after its mutation resolves.
 *
 * Every shopping add surface writes the item to the cache before firing and
 * shares one keep/revert rule: a `'rejected'` result (a real error, or a
 * non-success payload such as ConflictError/ValidationError) discards the
 * optimistic item; `'created'` / `'queued'` keep it — a queued create replays
 * later, keyed by the same `id`. Centralizing the payload key, success typename,
 * and the stat-aware revert here keeps them in one place so they can't drift
 * across the many add sites. Returns whether the optimistic item was kept or
 * reverted so the caller can drive its own success / error UX.
 */
export function reconcileShoppingCreate(
  cache: ApolloCache,
  listId: string,
  optimisticId: string,
  result: { data?: unknown; error?: unknown } | null | undefined,
): 'kept' | 'reverted' {
  const outcome = classifyCreateResult(result);
  // Each add fires the batch mutation with a single item. The batch can resolve
  // successfully while that one item fails (`results[0].success === false`, e.g.
  // a per-item validation error reported inside the batch rather than as a
  // top-level error member). Revert the optimistic row in that case too.
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
 * Catalog-merge reconciliation: when the server merges a client-created item
 * into an existing catalog row, the returned id differs from the client cuid we
 * wrote optimistically. Evict the stale cuid entity so its (now-dangling)
 * connection edge is dropped by the self-healing read and the server row stands.
 *
 * `clientId` is read off the mutation's own `variables` at the call site (never a
 * shared ref), so this stays correct when adds overlap. A no-op when the server
 * echoed the same id (no merge).
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
 * The row's own record of where it belongs, read at withdrawal time by
 * {@link restoreItemToShoppingListAfterMoveToPantry}. Selects only what the
 * restore needs — which list, and which filtered variant of its connection.
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
 * Remove a single item from ShoppingList cache when moving to pantry.
 *
 * Unlike the generic `createRemoveFromParentConnectionUpdater`, this only
 * modifies the correct filtered variant (purchased or unpurchased) based on
 * the item's purchase status, preventing incorrect totalCount decrements
 * on the other tab.
 *
 * Also updates `completedItems` and `totalItems` counters on the ShoppingList.
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

    // The edge operation first, on its own, recording whether it changed
    // anything. The counters follow from that rather than assuming it — this
    // helper runs TWICE for one online move (the eager pre-fire unlink, then
    // the mutation's update callback), and `edges.filter` is idempotent while
    // `-1` is not. Two passes because `cache.modify` visits an entity's fields
    // in the STORE's order, so a flag set by one modifier cannot be read by
    // another in the same call.
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

    // Evicting is for the CONFIRMED move: once the server has the row, the
    // local entity is dead weight. The eager (pre-fire) call keeps it, because
    // a permanently-refused replay has to put the row back and there is no
    // snapshot to rebuild it from — see
    // {@link restoreItemToShoppingListAfterMoveToPantry}.
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
 * Put a shopping row back after a move to the pantry was permanently refused.
 *
 * The mirror of {@link removeItemFromShoppingListForMoveToPantry}'s non-evicting
 * form. The row is unlinked from its list connection before the mutation fires,
 * so the move is visible with no network; if the queue then gives up on the
 * write, the pantry side is withdrawn by the generic evict and this restores the
 * shopping side. Without it the item would be in neither list — observed on
 * device on a move that timed out, retried, and came back NotFound.
 *
 * Reads the list id and purchase state from the still-cached entity rather than
 * taking them as arguments: the withdrawal runs long after the call site is
 * gone, and the entity is the only surviving record of where the row belongs.
 * A no-op when the entity is gone (already evicted, or never written).
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
    // rather than assuming it. This runs from the queue's withdrawal AND from
    // the call site's own revert, and guarding only the insert made it
    // idempotent in the one effect a test could see.
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

// =============================================================================
// Shopping list local-first create (the list itself, not its items)
// =============================================================================

/**
 * Display shape of the optimistic `ShoppingList` entity written by
 * {@link addOptimisticShoppingList}. Mirrors what the lists-overview query
 * (`GetShoppingListsLite`) selects per node, so the overview reads complete
 * from cache while fully offline.
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
  // Nullable per the schema: `User.email` only resolves for the caller's own
  // record. The optimistic row is always the creator's, so it is populated
  // here, but the cache shape has to match what the server write-through
  // carries or the entity would be overwritten with a type mismatch.
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
 * A list arriving through any create path is never a template, so the
 * `filters: { isTemplate: true }` variant GetShoppingListTemplates reads is the
 * one place it must not land. Beyond showing a plain list in the template
 * picker, that variant selects `templateName` — a field an optimistic list
 * doesn't carry — and one edge missing it makes the whole query read
 * incomplete, blanking the picker until the next network response.
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
 * Build a complete optimistic `ShoppingList` for a local-first create.
 *
 * `id` is the client-minted cuid sent as `input.id` — the row's permanent PK —
 * so the online create and the queued offline replay converge on one row.
 * Owner display data (avatar, display name) comes from the cache's canonical
 * `User` entity; when that copy is incomplete, falls back to the auth-store
 * identity with a `null` profile rather than risk clobbering cached profile
 * fields with stubs — the post-replay refetch heals the gap. The home chip is
 * resolved the same way and degrades to `null` when the `Home` entity isn't
 * cached.
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
 * Local-first optimistic add: write a new ShoppingList to the cache
 * PERMANENTLY (full entity + overview connection edge + empty filtered
 * `itemsConnection` variants) BEFORE the create mutation fires, so it survives
 * a fully-offline / API-down create. The queue replays the original
 * `CreateShoppingList` keyed by `input.id`; a duplicate replay surfaces as a
 * ConflictError, which the queue drops — the first attempt's row stands.
 *
 * Seeding both `filters: { isPurchased }` variants empty is what makes the
 * fresh list immediately usable offline: the items screen reads complete from
 * cache, and local-first item adds have an existing variant for their
 * `cache.modify` edge writes (a modifier never creates a missing variant).
 *
 * Caveat: `isDefault: true` doesn't clear the flag on other cached lists; the
 * server resolves the single-default rule on replay and the next refetch
 * reconciles the flags.
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
      // Neutral base derived from the SDL (see
      // scripts/generate-optimistic-fillers.mjs) so a field added to the
      // fragment cannot be forgotten here — that omission is invisible until
      // the detail screen blanks offline. A brand-new list is neutral in every
      // one of these: no template, no recurrence, no reminder, nothing spent,
      // no collaborators, and nothing to move to a pantry until it has items.
      ...NEUTRAL_SHOPPING_LIST_DETAIL,
      id: list.id,
    },
  });

  // 4. Edge into the lists overview (every cached filter variant).
  addShoppingListToQueryCache(cache, list);
}

/**
 * Remove a list from the cache entirely: the overview connection edge is
 * filtered + `totalCount` decremented explicitly (`Query.shoppingLists` has no
 * dangling-edge read filter, unlike `itemsConnection`'s self-healing read),
 * then the entity is evicted. Used both to revert a rejected optimistic create
 * and as the local-first removal for a list delete.
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
 * Snapshot a list's display shape before a local-first delete, so a server
 * rejection can restore it via {@link addOptimisticShoppingList} (items
 * repopulate on the next visit's refetch). Null when the cache copy is
 * incomplete — the caller then relies on the next overview refetch instead.
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
 * Reconcile a local-first list create after its mutation resolves. Same
 * keep/revert rule as {@link reconcileShoppingCreate}: a `'rejected'` result
 * (a surfaced error, or a non-success payload such as
 * ConflictError/ValidationError) discards the optimistic list; `'created'` /
 * `'queued'` keep it — a queued create replays later, keyed by the same `id`.
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
