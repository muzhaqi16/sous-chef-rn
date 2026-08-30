/**
 * The one optimistic `PantryItem` builder for local-first creates; it must stay
 * in lockstep with the `CreatePantryItem` selection. COMPLETENESS is
 * load-bearing: one field `GetPantry` selects but this omits makes the cache read
 * incomplete, so the item stays INVISIBLE for the whole offline session.
 */

import { gql, type ApolloCache } from '@apollo/client';
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
  /** Resolved against the cached `Unit` — see {@link readCachedUnit}. */
  unitId?: string | null;
  storageState?: StorageState | null;
  /** ISO date string. */
  expiresAt?: string | null;
  /** Storage location *name* (an optimistic placeholder id is generated). */
  location?: string | null;
  minQuantity?: number | null;
}

/**
 * The unit fields every consumer of a pantry list node reads: the card shows
 * `symbol`, the action modals (whose fragment is spread into `GetPantry`) also
 * read `name`, `type`, and `displayAsFraction`.
 */
const OptimisticUnitFragment = gql`
  fragment _OptimisticPantryUnit on Unit {
    id
    name
    symbol
    type
    displayAsFraction
  }
`;

/**
 * Reads the real unit rather than writing a `{id, name, symbol}` stub, so
 * `type`/`displayAsFraction` stay readable. `readFragment` returns null on a
 * PARTIALLY cached entity exactly as on a missing one, so any caller fetching
 * fewer than these five fields silently lands in the null branch.
 */
function readCachedUnit(
  cache: ApolloCache | undefined,
  unitId: string | null | undefined,
): OptimisticPantryItem['unit'] {
  if (!cache || !unitId) return null;
  const cacheId = cache.identify({ __typename: 'Unit', id: unitId });
  if (!cacheId) return null;
  return cache.readFragment<OptimisticPantryItem['unit']>({
    id: cacheId,
    fragment: OptimisticUnitFragment,
    fragmentName: '_OptimisticPantryUnit',
  });
}

/**
 * `id` is the client-minted cuid (the row's real PK once synced). Everything the
 * `CreatePantryItem` selection requires but is unpredictable client-side (batch
 * counts, breakdowns, derived weights) gets a neutral default, replaced by the
 * server entity on response / replay.
 */
export function buildOptimisticPantryItem(
  id: string,
  fields: OptimisticPantryItemFields,
  cache?: ApolloCache,
): OptimisticPantryItem {
  const catalogItemId = fields.itemId ?? '';
  return createOptimisticEntity<OptimisticPantryItem>('PantryItem', id, {
    // Selected by GetPantry on every node and read by the local sort
    // comparators — omitting it strands the whole list offline.
    createdAt: new Date().toISOString(),
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
    unit: readCachedUnit(cache, fields.unitId),
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
