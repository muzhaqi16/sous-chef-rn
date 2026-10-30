import { byOperation } from '#/apollo/utils/documentOperation';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import { AddDerivedItemsToShoppingListDocument } from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/hooks/useAddPantryItemToShoppingList.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/hooks/usePantryItemDetailActions.generated';
import { AddItemsToShoppingListFromRecipeDocument } from '#features/recipes/hooks/useRecipeShoppingList.generated';
import {
  AddItemToShoppingListDocument,
  CancelRecurringDocument,
  CompleteShoppingListDocument,
  CreateRecurringShoppingListDocument,
  CreateShoppingListDocument,
  DeleteShoppingListDocument,
  DeleteShoppingListReminderDocument,
  MarkAsTemplateDocument,
  MarkShoppingListActiveDocument,
  MarkShoppingListAsDefaultDocument,
  MoveShoppingListItemDocument,
  RemoveItemFromShoppingListDocument,
  RemoveItemsFromShoppingListDocument,
  UpdateShoppingListDocument,
  UpdateShoppingListItemDocument,
  UpdateShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  addRows,
  createList,
  removeList,
  removeRows,
  reorderRow,
  updateRow,
} from '#features/shoppingList/offline/localWrites';
import { entityFields } from './entityFields';
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
  [AddItemsToShoppingListFromRecipeDocument, addRows],
  [AddDerivedItemsToShoppingListDocument, addRows],
  [CreateShoppingListDocument, createList],
  [DeleteShoppingListDocument, removeList],
  [UpdateShoppingListItemDocument, updateRow],
  [RemoveItemFromShoppingListDocument, removeRows],
  [RemoveItemsFromShoppingListDocument, removeRows],
  [MoveShoppingListItemDocument, reorderRow],
  [UpdateShoppingListDocument, entityFields],
  [CompleteShoppingListDocument, entityFields],
  [MarkShoppingListActiveDocument, entityFields],
  [MarkShoppingListAsDefaultDocument, entityFields],
  [MarkAsTemplateDocument, entityFields],
  [CreateRecurringShoppingListDocument, entityFields],
  [CancelRecurringDocument, entityFields],
  [UpdateShoppingListReminderDocument, entityFields],
  [DeleteShoppingListReminderDocument, entityFields],
]);
