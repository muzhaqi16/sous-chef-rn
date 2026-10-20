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
import type { ListCounterChange } from './connections';
import {
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
  stampItemKeptOnListAfterMoveToPantry,
  unstampItemKeptOnListAfterMoveToPantry,
  type KeptOnListStamp,
} from './moveToPantry';
import { readIsPurchased } from './purchase';

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
 * A move-to-pantry's local side, written eagerly (offline nothing answers, and a
 * replay runs no `update`): the pantry row under a minted id the caller claimed
 * (`unconfirmedCreates.mark`); the list line UNLINKED, not evicted, for a re-link.
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
  // The eager removal and the response's update must agree on the variant, or
  // the removal lands on the wrong tab and decrements the wrong `totalCount`.
  const wasPurchased = readIsPurchased(cache, item.id);
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
      readIsPurchased(cache, shoppingListItemId),
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
