import { byOperation } from '#/apollo/utils/documentOperation';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/hooks/useAddPantryItemToShoppingList.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/hooks/usePantryItemDetailActions.generated';
import {
  AddItemToShoppingListDocument,
  MoveShoppingListItemDocument,
  RemoveItemFromShoppingListDocument,
  RemoveItemsFromShoppingListDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addRows,
  removeRows,
  reorderRow,
  updateRow,
} from '#features/shoppingList/offline/localWrites';
import type { LocalWrite, LocalWriteTable } from './types';

/**
 * Every feature's local writes, keyed by the operation its document declares.
 * See {@link REPLAY_PREPARATIONS} for why this is a list here rather than a
 * manifest field.
 */
export const LOCAL_WRITES: LocalWriteTable = byOperation<LocalWrite>([
  [AddItemToShoppingListDocument, addRows],
  [AddItemToShoppingListFromFilteredPantryDocument, addRows],
  [AddItemToShoppingListFromPantryItemDocument, addRows],
  [BarcodeAddItemToShoppingListDocument, addRows],
  [UpdateShoppingListItemDocument, updateRow],
  [RemoveItemFromShoppingListDocument, removeRows],
  [RemoveItemsFromShoppingListDocument, removeRows],
  [MoveShoppingListItemDocument, reorderRow],
]);
