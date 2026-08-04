/**
 * buildOptimisticPantryItem — shared optimistic entity builder for pantry creates.
 *
 * Every pantry "create" site (the two add sheets, the form-submission hooks,
 * onboarding) writes the new item to
 * the cache PERMANENTLY before firing the mutation so it survives a fully-offline
 * / API-down create (the queue replays via SyncPantryItem(clientId = id)). They
 * all need the same complete `PantryItem` shape — a single source of truth here
 * keeps the optimistic entity in lockstep with the `CreatePantryItem` selection
 * (an incomplete shape makes list cells' `useFragment` report `complete: false`
 * and blank the row).
 *
 * **Completeness is load-bearing, not cosmetic.** `GetPantry` reads every field
 * below off each list node. One missing field makes the whole query's cache read
 * incomplete, and Apollo then hands `useQuery` no data at all (there is no
 * `returnPartialData`) and goes to the network. Online that is invisible — the
 * refetch returns the full node a moment later. Offline there is no refetch:
 * `offlineModeLink` re-reads the same incomplete cache, reports a miss, and the
 * pantry falls back to its pre-add snapshot via `usePreservedConnection`. The
 * item is queued and replays correctly on reconnect, but it stays INVISIBLE for
 * the whole offline session. `__tests__/apollo/optimisticEntityCompleteness.test.ts`
 * locks this invariant in.
 *
 * The returned object is a valid `PantryItem` node for
 * `addToPantryItemsCache` (which writes the entity via `toReference(item, true)`
 * and adds the connection edge).
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
 * Resolve the optimistic item's `unit` from the cache.
 *
 * Reading the real unit — rather than writing a hand-built `{id, name, symbol}`
 * stub — is what keeps `type`/`displayAsFraction` readable. A stub without them
 * strands the whole pantry query (see the module doc), and it also puts the
 * unit's real `symbol` on the row instead of a placeholder.
 *
 * (It is NOT about protecting the shared `Unit` entity from the stub. The
 * writer, `addToPantryItemsCache`, calls `toReference(item, true)`, which
 * normalizes only the top-level `PantryItem`; nested objects are stored
 * embedded on it, so a stub could never have reached `Unit:<id>` to overwrite
 * anything.)
 *
 * A unit id at an add site comes from something already fetched, but "fetched"
 * has to mean *these five fields* — `readFragment` returns null on a partial
 * entity just as it does on a missing one. The unit autocomplete
 * (`SearchUnits` / `GetCommonUnits`) and an item's `displayUnit`
 * (`item.graphql`) all select them. Anything narrower silently lands in the
 * null branch below: the optimistic item carries no unit and the quantity
 * renders bare until the create response or replay supplies the real one —
 * which still beats stranding the whole list.
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
 * Build a complete optimistic `PantryItem` for local-first creates.
 *
 * @param id - the client-minted cuid (the row's real PK once synced)
 * @param fields - the core fields available at the call site; everything the
 *   `CreatePantryItem` selection requires but isn't predictable client-side
 *   (batch counts, breakdowns, derived weights) defaults to a neutral value and
 *   is replaced by the authoritative server entity on response / replay.
 * @param cache - used to resolve `fields.unitId` to the cached `Unit`
 *   ({@link readCachedUnit}). Omit only where no unit id is passed.
 */
export function buildOptimisticPantryItem(
  id: string,
  fields: OptimisticPantryItemFields,
  cache?: ApolloCache,
): OptimisticPantryItem {
  const catalogItemId = fields.itemId ?? '';
  return createOptimisticEntity<OptimisticPantryItem>('PantryItem', id, {
    // Selected by GetPantry on every node (the screen's local sort comparators
    // read it) — a missing createdAt is enough to strand the whole list
    // offline. The server value replaces this on response / replay.
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
