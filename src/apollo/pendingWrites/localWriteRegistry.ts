import { byOperation } from '#/apollo/utils/documentOperation';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import {
  CreateStorageLocationDocument,
  DeleteStorageLocationDocument,
  MarkStorageLocationAsDefaultDocument,
  UpdateStorageLocationDocument,
} from '#features/catalog/graphql/storageLocation.generated';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from '#features/catalog/hooks/useUsualStoreWrites.generated';
import {
  addUsualStore,
  createLocation,
  createStore,
  locationFields,
  pinUsualStore,
  removeLocation,
  removeUsualStore,
} from '#features/catalog/offline/localWrites';
import {
  AdjustPantryItemQuantityDocument,
  ConvertExpiredToWasteDocument,
  CorrectPantryItemPackageSizeDocument,
  CreatePantryDocument,
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  DeletePantryDocument,
  DeletePantryItemDocument,
  MarkPantryAsDefaultDocument,
  OpenPantryItemBatchDocument,
  RestockPantryItemDocument,
  UpdatePantryDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
  WastePantryItemBatchDocument,
} from '#features/pantry/graphql/pantry.generated';
import { AddDerivedItemsToShoppingListDocument } from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/hooks/useAddPantryItemToShoppingList.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/hooks/usePantryItemDetailActions.generated';
import {
  addStock,
  createItem,
  createPantry,
  discardExpired,
  drawStock,
  removeItem,
  removePantry,
  setStock,
} from '#features/pantry/offline/localWrites';
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
  MoveShoppingItemToPantryDocument,
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
  moveToPantry,
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
  [MoveShoppingItemToPantryDocument, moveToPantry],
  [CreatePantryItemDocument, createItem],
  [UpdatePantryItemDocument, entityFields],
  [UpdatePantryItemQuantityDocument, setStock],
  [AdjustPantryItemQuantityDocument, setStock],
  [DeletePantryItemDocument, removeItem],
  [CreatePantryItemUsageDocument, drawStock],
  [RestockPantryItemDocument, addStock],
  [ConvertExpiredToWasteDocument, discardExpired],
  [OpenPantryItemBatchDocument, entityFields],
  [WastePantryItemBatchDocument, entityFields],
  [CorrectPantryItemPackageSizeDocument, entityFields],
  [CreatePantryDocument, createPantry],
  [UpdatePantryDocument, entityFields],
  [DeletePantryDocument, removePantry],
  [MarkPantryAsDefaultDocument, entityFields],
  [CreateStorageLocationDocument, createLocation],
  [UpdateStorageLocationDocument, locationFields],
  [MarkStorageLocationAsDefaultDocument, locationFields],
  [DeleteStorageLocationDocument, removeLocation],
  [CreateStoreDocument, createStore],
  [AddUsualStoreDocument, addUsualStore],
  [UpdateUsualStoreDocument, pinUsualStore],
  [RemoveUsualStoreDocument, removeUsualStore],
]);
