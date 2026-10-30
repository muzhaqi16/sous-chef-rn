/**
 * One shopping list line as the device shows it until the server answers.
 */

import type { ApolloCache } from '@apollo/client';
import {
  Items_ItemDepartmentFragmentDoc,
  Items_RowFragmentDoc,
} from './items.generated';
import {
  NEUTRAL_LOCAL_SHOPPING_LIST_ITEM,
  NEUTRAL_LOCAL_SHOPPING_LIST_ITEM_BY_TYPE,
} from './shoppingListItemRowNeutral.generated';
import { isHeld, writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import {
  DisplayFormat,
  StoreDepartment,
} from '#/graphql/generated/schemaTypes';
import { isRecord } from '#/utils/isRecord';
import { addNewItemToShoppingListCache, readListCounters } from './connections';

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
export const createLocalShoppingListItem = (
  id: string,
  fields: OptimisticShoppingListItemFields,
): LocalShoppingListItem => ({ ...fields, id });

/** The aisle a catalog item is shelved in, when the cache holds it. */
function heldItemDepartment(
  cache: ApolloCache,
  itemId: string | null | undefined,
): StoreDepartment | undefined {
  if (!itemId) return undefined;
  return cache.readFragment({
    id: cache.identify({ __typename: 'Item', id: itemId }),
    fragment: Items_ItemDepartmentFragmentDoc,
    fragmentName: 'items_itemDepartment',
    optimistic: true,
  })?.storeDepartment;
}

/**
 * Writes the FULL display entity, its edge and recomputed stats, so an offline
 * create shows on every screen. `item.id` MUST be the client-minted cuid sent
 * as `input.id`, or the replay dupes. A row already held is the server's, with
 * its version and its place in the totals: only its edge is written.
 */
export function addLocalShoppingListItem(
  cache: ApolloCache,
  listId: string,
  line: LocalShoppingListItem,
  now: string,
): void {
  const item = { __typename: 'ShoppingListItem', id: line.id };
  if (isHeld(cache, item)) {
    addNewItemToShoppingListCache(cache, listId, item, false);
    return;
  }

  // 1. The row, complete for every screen: what the create knows, else what the
  //    cache holds (a catalog item's image, a unit's symbol), else neutral.
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
      // Shelved where its item is until the server answers (the API's rule).
      storeDepartment:
        heldItemDepartment(cache, line.itemId) ?? StoreDepartment.Other,
      storeDepartmentOverride: null,
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
 * Whether `list`, from a response, is THIS list with its totals, which Apollo
 * has already written over the local count. Another list settles nothing here.
 */
export function carriesListTotals(list: unknown, listId: string): boolean {
  return (
    isRecord(list) && list.id === listId && typeof list.totalItems === 'number'
  );
}
