import {
  AcquisitionMethod,
  type StockAmountInput,
  type StorageState,
  type UnitType,
} from '#graphql/generated/schemaTypes';
import { localQuantity, packagesNeedSizing } from '#domain/stockAmount';
import type { LocalPantryItem } from '#entities/pantryItem/writeLocalPantryItem';
import { unitPriceFromTotal } from './purchasePrice';
/** What a move reads of the list line it takes off the list. */
interface MovedLine {
  itemName?: string | null;
  item?: { id: string } | null;
  unit?: { id: string; type: UnitType } | null;
}

export interface LocalMoveArgs {
  item: MovedLine;
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
    quantity: localQuantity(amount),
    itemId: item.item?.id,
    // The API tracks the stack in the stated unit, else the line's own. Packages
    // it must size claim no unit until it answers, so no weight is invented.
    unitId:
      measured?.unitId ??
      packages?.unitId ??
      (packagesNeedSizing(amount, item) ? undefined : item.unit?.id),
    packageSize: packages?.size,
    storageState,
    expiresOn,
    acquisitionMethod: AcquisitionMethod.ShoppingList,
    costPerUnit: measured
      ? unitPriceFromTotal(totalCost ?? null, measured.quantity)
      : null,
  };
}
