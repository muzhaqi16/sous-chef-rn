/**
 * The local-first lifecycle of one shopping list line: the optimistic entity, the
 * revert, and the reconcile that adopts the server id.
 */

import type { ApolloCache } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { Items_RowFragmentDoc } from './items.generated';
import {
  NEUTRAL_LOCAL_SHOPPING_LIST_ITEM,
  NEUTRAL_LOCAL_SHOPPING_LIST_ITEM_BY_TYPE,
} from './shoppingListItemRowNeutral.generated';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';
import {
  settleMutation,
  settledStatus,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import { errorService } from '#/services/errorService';
import { addNewItemToShoppingListCache, readListCounters } from './connections';
import { withdrawShoppingListItems } from './withdraw';

export interface OptimisticShoppingListItemFields {
  /** The row names its list by it; `moveToPantry` reads it back. */
  shoppingListId: string;
  itemName: string;
  quantity?: number | null;
  quantityInput?: string | null;
  unitName?: string | null;
  category?: string | null;
  itemId?: string | null;
  unitId?: string | null;
}

/** What a create knows about the line it adds, under its client-minted id. */
export type LocalShoppingListItem = OptimisticShoppingListItemFields & {
  id: string;
};

/**
 * The line a local-first create adds. `id` is the client-minted cuid (the row's
 * PK), so the online create and the queued replay converge on one row.
 */
export const createOptimisticShoppingListItem = (
  id: string,
  fields: OptimisticShoppingListItemFields,
): LocalShoppingListItem => ({ ...fields, id });

export function reconcileShoppingItemCreateUpdate(
  cache: ApolloCache,
  listId: string,
  serverItem: { id: string },
  clientId: string | null | undefined,
  { countsSettled = false }: { countsSettled?: boolean } = {},
): void {
  if (clientId && serverItem.id !== clientId) {
    // Catalog merge: the server folded the line into an EXISTING row, so the
    // optimistic add counted a row that never came to exist. Its count comes
    // back relatively only when the response did not state the totals.
    revertOptimisticShoppingListItem(cache, listId, clientId, {
      countsSettled,
    });
  }
  addNewItemToShoppingListCache(cache, listId, serverItem, false);
}

// Structural slices the builder below reads, kept loose so every
// add-to-shopping-list mutation document satisfies the shape.
interface AddItemsReconcilePayloadLike {
  __typename?: string;
  shoppingList?: unknown;
  results?:
    | readonly ({
        index?: number | null;
        success?: boolean | null;
        item?: { id: string } | null;
      } | null)[]
    | null;
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
  wrap?: { operation: string; refetch?: () => void };
}

/**
 * The mutation `update` shared by every add-to-shopping-list entry point: EVERY
 * result is reconciled, each paired back to the id its caller minted by `index`.
 * List id from `listId`, else `variables.input.shoppingListId`.
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
    const payload = appliedPayload(data);
    const targetListId = listId ?? variables?.input.shoppingListId;
    if (!payload || !targetListId || !variables) return;
    const results = payload.results;
    if (!results?.length) return;
    const run = () => {
      // The payload's list is resolved after the whole batch, so the refused
      // lines are already out of its count.
      const countsSettled = carriesListTotals(
        payload.shoppingList,
        targetListId,
      );
      const refused: string[] = [];
      results.forEach((result, position) => {
        if (!result) return;
        // Paired by the input INDEX the server echoes, not by `result.clientId`:
        // that field is a response-matching token a call site picks freely (the
        // recipe add sends a Spoonacular ingredient id), never this row's
        // minted cuid. Array position is the fallback.
        const clientId = variables.input.items?.[result.index ?? position]?.id;
        const { item } = result;
        if (item && result.success !== false) {
          reconcileShoppingItemCreateUpdate(
            cache,
            targetListId,
            item,
            clientId,
            { countsSettled },
          );
        } else if (clientId) {
          refused.push(clientId);
        }
      });
      withdrawShoppingListItems(cache, targetListId, refused, {
        countsSettled,
      });
    };
    if (wrap) {
      try {
        run();
      } catch (cacheError) {
        errorService.reportError(cacheError, { operation: wrap.operation });
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
 * fully-offline create (the queue replays the batch add under the same id).
 * `item.id` MUST be the client-minted cuid sent as `input.id`, or the replay dupes.
 */
export function addOptimisticShoppingListItem(
  cache: ApolloCache,
  listId: string,
  line: LocalShoppingListItem,
): void {
  // 1. The row, complete for every screen: what the create knows, else what the
  //    cache holds (a catalog item's image, a unit's symbol), else neutral.
  const now = new Date().toISOString();
  writeLocalEntity(cache, {
    fragment: Items_RowFragmentDoc,
    fragmentName: 'items_row',
    neutral: NEUTRAL_LOCAL_SHOPPING_LIST_ITEM,
    neutralByType: NEUTRAL_LOCAL_SHOPPING_LIST_ITEM_BY_TYPE,
    known: {
      __typename: 'ShoppingListItem',
      id: line.id,
      // The server owns the version; its response carries the real one.
      version: 1,
      createdAt: now,
      updatedAt: now,
      shoppingList: { __typename: 'ShoppingList', id: line.shoppingListId },
      itemName: line.itemName,
      quantity: line.quantity ?? 1,
      quantityInput: line.quantityInput ?? null,
      displayFormat: DisplayFormat.Auto,
      unitName: line.unitName ?? null,
      category: line.category ?? null,
      notes: null,
      sortOrder: '',
      // Whole rather than through `writePurchaseInfo`, which patches an
      // existing record: a new line has no prior purchase to preserve.
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: false,
        movedToPantryAt: null,
      },
      item: line.itemId ? { __typename: 'Item', id: line.itemId } : null,
      unit: line.unitId ? { __typename: 'Unit', id: line.unitId } : null,
    },
  });
  const item = { __typename: 'ShoppingListItem', id: line.id };

  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });

  // 2. Snapshot completedItems BEFORE the add — a new row is unpurchased, so it
  //    is unchanged, and remaining/completion derive from it.
  const counters = parentCacheId ? readListCounters(cache, parentCacheId) : {};
  const completed = counters.completedItems ?? 0;

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
 * repairs only its own `totalCount`. That read drops the dangling edge. One line
 * of {@link withdrawShoppingListItems}, so a second run changes nothing.
 */
export function revertOptimisticShoppingListItem(
  cache: ApolloCache,
  listId: string,
  clientId: string,
  { countsSettled = false }: { countsSettled?: boolean } = {},
): void {
  withdrawShoppingListItems(cache, listId, [clientId], { countsSettled });
}

/**
 * Whether `list`, from a response, is THIS list with its totals, which Apollo
 * has already written over the local count. Another list settles nothing here.
 */
export function carriesListTotals(list: unknown, listId: string): boolean {
  return (
    isRecord(list) && list.id === listId && typeof list.totalItems === 'number'
  );
}

/**
 * Reconcile a local-first item create once the mutation resolves: `'failed'`
 * discards the optimistic row, `'applied'` / `'queued'` keep it — a queued create
 * replays later, keyed by the same `id`. Returns which happened, so the caller can
 * drive its own success / error UX.
 */
export function reconcileShoppingCreate(
  cache: ApolloCache,
  listId: string,
  optimisticId: string,
  result: { data?: unknown; error?: unknown } | null | undefined,
): 'kept' | 'reverted' {
  const failed = settledStatus(result ?? undefined) === 'failed';
  // The batch can resolve successfully while its single item fails
  // (`results[0].success === false` — a per-item validation error reported inside
  // the batch rather than as a top-level error member). Revert that too.
  const applied = appliedPayload(
    (
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
    )?.data,
  );
  const itemFailed = applied?.results?.[0]?.success === false;
  if (failed || itemFailed) {
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

/** The API refuses a batch add of more lines than this. */
const ADD_ITEMS_BATCH_LIMIT = 50;

/**
 * Sends optimistic lines as batch adds the API accepts, each slice settled on
 * its own: a failed slice takes back its own rows. Returns the first failure,
 * for the caller to present, or null when every slice applied or queued.
 */
export async function addItemsInSlices<TItem extends { id?: string | null }>(
  cache: ApolloCache,
  listId: string,
  items: readonly TItem[],
  send: (slice: TItem[]) => Promise<{ data?: unknown; error?: unknown }>,
  settle: { document: DocumentNode; fallback: string },
): Promise<SettledFailure | null> {
  let firstFailure: SettledFailure | null = null;
  // In order: a queued slice replays behind the one before it.
  for (let start = 0; start < items.length; start += ADD_ITEMS_BATCH_LIMIT) {
    const slice = items.slice(start, start + ADD_ITEMS_BATCH_LIMIT);
    const settled = await settleMutation(() => send(slice), {
      ...settle,
      present: 'none',
      onFailed: () => revertSlice(cache, listId, slice),
    });
    firstFailure ??= settled.failure ?? null;
  }
  return firstFailure;
}

function revertSlice(
  cache: ApolloCache,
  listId: string,
  slice: readonly { id?: string | null }[],
): void {
  const ids = slice.flatMap(line => (line.id ? [line.id] : []));
  try {
    withdrawShoppingListItems(cache, listId, ids);
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: 'Revert refused shopping list batch',
    });
  }
}
