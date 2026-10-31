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
  revertOptimisticPantryItem,
} from '#features/pantry/cache/items';
import {
  writeLocalPantryItem,
  type LocalPantryItem,
} from '#features/pantry/cache/writeLocalPantryItem';
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

/** The pantry row a move shows until the server answers. */
export function localMoveRow({
  item,
  pantryId,
  amount,
  storageState,
  expiresOn,
  totalCost,
}: Pick<
  LocalMoveArgs,
  'item' | 'pantryId' | 'amount' | 'storageState' | 'expiresOn' | 'totalCost'
>): LocalPantryItem {
  const { measured, packages } = amount;
  return {
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
}

/**
 * A move-to-pantry's local side, written eagerly (offline nothing answers, and a
 * replay runs no `update`): the pantry row under a minted id the caller claimed
 * (`unconfirmedCreates.mark`); the list line UNLINKED, not evicted, for a re-link.
 */
export function writeLocalMove(
  cache: ApolloCache,
  args: LocalMoveArgs,
): LocalMove {
  const { item, pantryId, pantryItemId, removeFromList, currentListId } = args;
  const now = new Date().toISOString();
  // The eager removal and the response's update must agree on the variant, or
  // the removal lands on the wrong tab and decrements the wrong `totalCount`.
  const wasPurchased = readIsPurchased(cache, item.id);
  const written: LocalMove = {};
  try {
    writeLocalPantryItem(cache, pantryItemId, localMoveRow(args), now);
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
        now,
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
