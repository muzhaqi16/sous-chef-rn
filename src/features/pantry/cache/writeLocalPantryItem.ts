import type { ApolloCache } from '@apollo/client';
import {
  StorageType,
  type AcquisitionMethod,
  type ItemCondition,
  type StorageState,
} from '#/graphql/generated/schemaTypes';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { GetPantryItemBatchesDocument } from '#features/pantry/graphql/pantry.generated';
import { WriteLocalPantryItem_RowFragmentDoc } from './writeLocalPantryItem.generated';
import {
  NEUTRAL_LOCAL_PANTRY_ITEM,
  NEUTRAL_LOCAL_PANTRY_ITEM_BY_TYPE,
} from './writeLocalPantryItemNeutral.generated';

/** What a create site knows about the row it adds. */
export interface LocalPantryItem {
  pantryId: string;
  itemName: string;
  /** The catalog item; a free-text create has none and gets a stand-in. */
  itemId?: string | null;
  quantity?: number | null;
  /** The stated unit only: the API resolves an unstated one from data the device lacks. */
  unitId?: string | null;
  storageState?: StorageState | null;
  expiresOn?: string | null;
  /** A free-text location's name. */
  location?: string | null;
  minQuantity?: number | null;
  restockQuantity?: number | null;
  condition?: ItemCondition | null;
  acquisitionMethod?: AcquisitionMethod | null;
  tags?: string[] | null;
  storageNotes?: string | null;
  costPerUnit?: number | null;
  brand?: { id: string; name: string } | null;
  store?: { id: string; name: string } | null;
}

/** The `Item` a free-text row points at until the server answers with one. */
const localItemIdFor = (pantryItemId: string): string =>
  `local-item-${pantryItemId}`;

/**
 * Writes a local-first create's row complete for every screen that reads a
 * pantry item, so it renders from the cache before the server has it. What the
 * create does not know is held data or the schema's neutral value, until the
 * server's row replaces it.
 */
export function writeLocalPantryItem(
  cache: ApolloCache,
  id: string,
  row: LocalPantryItem,
): void {
  const now = new Date().toISOString();
  const quantity = row.quantity ?? 1;
  const unit = row.unitId
    ? { __typename: 'Unit', id: row.unitId }
    : NEUTRAL_LOCAL_PANTRY_ITEM.unit;
  const costPerUnit = row.costPerUnit ?? null;

  writeLocalEntity(cache, {
    fragment: WriteLocalPantryItem_RowFragmentDoc,
    fragmentName: 'writeLocalPantryItem_row',
    // The typed name stands in only where the device holds no catalog name.
    neutral: {
      ...NEUTRAL_LOCAL_PANTRY_ITEM,
      item: { ...NEUTRAL_LOCAL_PANTRY_ITEM.item, name: row.itemName },
    },
    neutralByType: NEUTRAL_LOCAL_PANTRY_ITEM_BY_TYPE,
    known: {
      __typename: 'PantryItem',
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
      pantryId: row.pantryId,
      itemId: row.itemId ?? '',
      itemName: row.itemName,
      item: {
        __typename: 'Item',
        id: firstNonBlank(row.itemId) ?? localItemIdFor(id),
      },
      quantity,
      // Fresh stock: every package is whole, so what is held is the count.
      heldQuantity: quantity,
      unit,
      displayAmount: { __typename: 'DisplayAmount', quantity, unit },
      storageLocation: row.location
        ? {
            __typename: 'StorageLocation',
            id: `optimistic-loc-${id}`,
            name: row.location,
            type: StorageType.Custom,
          }
        : null,
      storageState: row.storageState ?? undefined,
      expiresOn: row.expiresOn ?? null,
      minQuantity: row.minQuantity ?? null,
      restockQuantity: row.restockQuantity ?? null,
      condition: row.condition ?? undefined,
      acquisitionMethod: row.acquisitionMethod ?? undefined,
      tags: row.tags ?? [],
      storageNotes: row.storageNotes ?? null,
      costPerUnit,
      totalCost: costPerUnit === null ? null : costPerUnit * quantity,
      brand: row.brand ? { __typename: 'Brand', ...row.brand } : null,
      store: row.store ? { __typename: 'Store', ...row.store } : null,
    },
  });

  // Batches are their own query, keyed on `pantryItemId`; empty is what a new
  // row has, and what lets its detail screen render offline.
  cache.writeQuery({
    query: GetPantryItemBatchesDocument,
    variables: { pantryItemId: id },
    data: {
      __typename: 'Query',
      pantryItemBatchesConnection: {
        __typename: 'PantryItemBatchConnection',
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

/** Undo what {@link writeLocalPantryItem} writes beside the row itself. */
export function evictLocalPantryItemSeeds(
  cache: ApolloCache,
  pantryItemId: string,
): void {
  safeEvict(cache, 'Item', localItemIdFor(pantryItemId));
  cache.evict({
    id: 'ROOT_QUERY',
    fieldName: 'pantryItemBatchesConnection',
    args: { pantryItemId },
  });
}
