import type { ApolloCache } from '@apollo/client';
import {
  AcquisitionMethod,
  type StockAmountInput,
  type StorageState,
} from '#/graphql/generated/schemaTypes';
import { localQuantity } from '#domain/stockAmount';
import { errorService } from '#/services/errorService';
import {
  addPantryItemLocally,
  reconcileCreatedPantryItem,
  revertOptimisticPantryItem,
  type PantryItemRef,
} from '#features/pantry/cache/items';
import { writeLocalPantryItem } from '#features/pantry/cache/writeLocalPantryItem';
import { unitPriceFromTotal } from '../utils/purchasePrice';
import type { ShoppingListItemDisplayFragment } from '../graphql/shoppingListFragments.generated';
import { UseMoveToPantry_WasPurchasedFragmentDoc } from '../hooks/useMoveToPantry.generated';
import type { ListCounterChange } from './connections';
import {
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
  stampItemKeptOnListAfterMoveToPantry,
  unstampItemKeptOnListAfterMoveToPantry,
  type KeptOnListStamp,
} from './moveToPantry';

/**
 * Which filtered variant of the list's connection the row sits in. Both the
 * eager removal and the response's update have to agree on this, or the
 * removal lands on the wrong tab and its `totalCount` decrements the wrong one.
 */
function readWasPurchased(cache: ApolloCache, itemId: string): boolean {
  const itemCacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: itemId,
  });
  if (!itemCacheId) return false;
  return (
    cache.readFragment({
      id: itemCacheId,
      fragment: UseMoveToPantry_WasPurchasedFragmentDoc,
    })?.purchaseInfo.isPurchased ?? false
  );
}

export interface LocalMoveArgs {
  item: ShoppingListItemDisplayFragment;
  pantryId: string;
  /** The minted id the move sends, so the cached row and the server's are one. */
  pantryItemId: string;
  amount: StockAmountInput;
  storageState?: StorageState;
  expiresOn?: string;
  totalCost?: number;
  removeFromList: boolean;
  currentListId: string | undefined;
}

/** What a local move wrote, so a refusal can undo exactly that. */
export interface LocalMove {
  counterChange?: ListCounterChange;
  keptStamp?: KeptOnListStamp;
}

/**
 * A move-to-pantry's local side, written before the move fires: the pantry row
 * under the minted id, and the list line unlinked or stamped as moved. BOTH are
 * written eagerly: offline no response arrives, and a replay runs no `update`.
 * The removal UNLINKS without evicting, so a refusal can re-link the entity.
 * The caller claims the minted id (`unconfirmedCreates.mark`) before calling.
 */
export function writeLocalMove(
  cache: ApolloCache,
  {
    item,
    pantryId,
    pantryItemId,
    amount,
    storageState,
    expiresOn,
    totalCost,
    removeFromList,
    currentListId,
  }: LocalMoveArgs,
): LocalMove {
  const { measured, packages } = amount;
  const localRow = {
    pantryId,
    itemName: item.itemName ?? '',
    quantity: localQuantity(amount, item),
    itemId: item.item?.id,
    // The API tracks the stack in the stated unit, else the line's own.
    unitId: measured?.unitId ?? packages?.unitId ?? item.unit?.id,
    storageState,
    expiresOn,
    acquisitionMethod: AcquisitionMethod.ShoppingList,
    costPerUnit: measured
      ? unitPriceFromTotal(totalCost ?? null, measured.quantity)
      : null,
  };
  const wasPurchased = readWasPurchased(cache, item.id);
  const written: LocalMove = {};
  try {
    writeLocalPantryItem(cache, pantryItemId, localRow);
    // Publishes the row AND counts it: offline no response corrects the count.
    addPantryItemLocally(cache, pantryId, {
      __typename: 'PantryItem',
      id: pantryItemId,
    });
    if (currentListId && removeFromList) {
      written.counterChange = removeItemFromShoppingListForMoveToPantry(
        cache,
        currentListId,
        item.id,
        wasPurchased,
        { evictEntity: false },
      );
    }
    if (currentListId && !removeFromList) {
      written.keptStamp = stampItemKeptOnListAfterMoveToPantry(
        cache,
        currentListId,
        item.id,
        wasPurchased,
      );
    }
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: 'Move Item to Pantry (optimistic)',
    });
  }
  return written;
}

/**
 * Undoes a refused local move: the pantry row is evicted, and the list line
 * re-linked or un-stamped. False when counters another write moved in the
 * meantime could not be restored exactly, so the caller re-reads them.
 */
export function revertLocalMove(
  cache: ApolloCache,
  {
    pantryId,
    pantryItemId,
    shoppingListItemId,
    removeFromList,
  }: {
    pantryId: string;
    pantryItemId: string;
    shoppingListItemId: string;
    removeFromList: boolean;
  },
  written: LocalMove,
): boolean {
  // Evicted, not only unlinked: a cached row persists and a detail read finds it.
  revertOptimisticPantryItem(cache, pantryId, pantryItemId);
  let exact = true;
  if (removeFromList) {
    exact = restoreItemToShoppingListAfterMoveToPantry(
      cache,
      shoppingListItemId,
      written.counterChange,
    );
  }
  if (written.keptStamp) {
    exact = unstampItemKeptOnListAfterMoveToPantry(cache, written.keptStamp);
  }
  return exact;
}

/**
 * A recorded move's cache side: reconcile the returned `PantryItem` with the
 * row written under the minted id, then drop the list line or bump the one
 * kept on the list.
 */
export function applyMoveToPantryCacheUpdate(
  cache: ApolloCache,
  args: {
    pantryId: string;
    shoppingListItemId: string;
    removeFromList: boolean | null | undefined;
    currentListId: string | undefined;
    pantryItem: PantryItemRef;
    /** The id the move minted for the row it wrote. */
    clientId: string | null | undefined;
  },
): void {
  const { pantryId, shoppingListItemId, removeFromList, currentListId } = args;

  // A restock answers with the EXISTING row's id: the row written under the
  // minted id goes, and the restocked fields normalize onto the existing one.
  reconcileCreatedPantryItem(cache, pantryId, args.pantryItem, args.clientId);

  if (!currentListId) return;

  if (removeFromList) {
    // Idempotent with the eager unlink: filtering an edge that is already gone
    // leaves the connection untouched. The evict is the part only the confirmed
    // path may do — offline the entity has to survive for the withdrawal.
    removeItemFromShoppingListForMoveToPantry(
      cache,
      currentListId,
      shoppingListItemId,
      readWasPurchased(cache, shoppingListItemId),
    );
    return;
  }
  // Kept on the list: the purchase stamp was written before the move fired;
  // this is the server's own bump of the line.
  const cacheId = cache.identify({
    __typename: 'ShoppingListItem',
    id: shoppingListItemId,
  });
  if (cacheId) {
    cache.modify<ShoppingListItemDisplayFragment>({
      id: cacheId,
      fields: {
        version(existingVersion = 0) {
          return existingVersion + 1;
        },
        updatedAt() {
          return new Date().toISOString();
        },
      },
    });
  }
}
