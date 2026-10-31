import {
  AcquisitionMethod,
  type StockAmountInput,
  type StorageState,
} from '#/graphql/generated/schemaTypes';
import { localQuantity } from '#domain/stockAmount';
import type { LocalPantryItem } from '#features/pantry/cache/writeLocalPantryItem';
import { unitPriceFromTotal } from '../utils/purchasePrice';
import type { ShoppingListItemDisplayFragment } from '../graphql/shoppingListFragments.generated';

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
