/**
 * buildOptimisticPantryItem — shared optimistic entity builder for pantry creates.
 *
 * Every pantry "create" site (the primary `usePantryItemMutations.addItem`, the
 * two add sheets, the form-submission hooks, onboarding) writes the new item to
 * the cache PERMANENTLY before firing the mutation so it survives a fully-offline
 * / API-down create (the queue replays via SyncPantryItem(clientId = id)). They
 * all need the same complete `PantryItem` shape — a single source of truth here
 * keeps the optimistic entity in lockstep with the `CreatePantryItem` selection
 * (an incomplete shape makes list cells' `useFragment` report `complete: false`
 * and blank the row).
 *
 * The returned object is a valid `PantryItem` node for
 * `addToPantryItemsCache` (which writes the entity via `toReference(item, true)`
 * and adds the connection edge).
 */

import type { Unmasked } from '@apollo/client/masking';
import { StorageState, StorageType } from '#/graphql/generated/schemaTypes';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import type { CreatePantryItemMutation } from '#features/pantry/graphql/pantry.generated';

type CreatePantryItemSuccessShape = Extract<
  Unmasked<CreatePantryItemMutation>['createPantryItem'],
  { __typename: 'CreatePantryItemPayload' }
>;

/** The full `PantryItem` shape the `CreatePantryItem` mutation selects. */
export type OptimisticPantryItem = CreatePantryItemSuccessShape['pantryItem'];

export interface OptimisticPantryItemFields {
  pantryId: string;
  itemName: string;
  quantity?: number | null;
  /** Catalog item id — links the optimistic row to an existing `Item` (image). */
  itemId?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  storageState?: StorageState | null;
  /** ISO date string. */
  expiresAt?: string | null;
  /** Storage location *name* (an optimistic placeholder id is generated). */
  location?: string | null;
  minQuantity?: number | null;
}

/**
 * Build a complete optimistic `PantryItem` for local-first creates.
 *
 * @param id - the client-minted cuid (the row's real PK once synced)
 * @param fields - the core fields available at the call site; everything the
 *   `CreatePantryItem` selection requires but isn't predictable client-side
 *   (batch counts, breakdowns, derived weights) defaults to a neutral value and
 *   is replaced by the authoritative server entity on response / replay.
 */
export function buildOptimisticPantryItem(
  id: string,
  fields: OptimisticPantryItemFields,
): OptimisticPantryItem {
  const catalogItemId = fields.itemId ?? '';
  return createOptimisticEntity<OptimisticPantryItem>('PantryItem', id, {
    pantryId: fields.pantryId,
    itemId: catalogItemId,
    itemName: fields.itemName,
    quantity: fields.quantity ?? 1,
    storageState: fields.storageState ?? StorageState.None,
    expiresAt: fields.expiresAt ?? null,
    lowStockAlert: false,
    isLowStock: false,
    minQuantity: fields.minQuantity ?? null,
    lastUsedAt: null,
    netWeight: null,
    remainingNetWeight: null,
    activeBatchCount: 0,
    earliestBatchExpiration: null,
    item: {
      __typename: 'Item',
      id: catalogItemId,
      imageUrl: null,
      images: [],
    },
    unit: fields.unitId
      ? {
          __typename: 'Unit',
          id: fields.unitId,
          name: fields.unitName ?? '',
          symbol: '',
        }
      : null,
    netWeightUnit: null,
    storageLocation: fields.location
      ? {
          __typename: 'StorageLocation',
          id: `optimistic-loc-${id}`,
          name: fields.location,
          type: StorageType.Custom,
        }
      : null,
    packageBreakdown: null,
    quantityBreakdown: null,
    pantry: {
      __typename: 'Pantry',
      id: fields.pantryId,
      stats: {
        __typename: 'PantryStats',
        totalItems: 0,
      },
    },
  });
}
