/**
 * Every feature that settles its own replay, keyed by the operation its
 * document declares. See {@link SYNC_REGISTRY} for why this is a list here
 * rather than a manifest field.
 */
import { byOperation } from '#/apollo/utils/documentOperation';
import { reconcileCreateHomeReplay } from '#features/home/offline/replayReconcilers';
import {
  reconcileCreatePantryItemReplay,
  reconcileMoveToPantryReplay,
} from '#features/pantry/offline/replayReconcilers';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { CreateHomeDocument } from '#operations/home/home.generated';
import {
  reconcileShoppingBatchReplay,
  reconcileShoppingRowReplay,
} from '#features/shoppingList/offline/replayReconcilers';
import {
  AddItemToShoppingListDocument,
  MoveShoppingItemToPantryDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { AddItemsToShoppingListFromRecipeDocument } from '#features/recipes/hooks/useRecipeDetail.generated';
import { CreateShoppingListItemFromRecipeIngredientDocument } from '#features/recipes/graphql/recipe.generated';
import {
  BarcodeAddItemToShoppingListDocument,
  BarcodeCreatePantryItemDocument,
} from '#features/barcode/hooks/useAddScannedItem.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/screens/FilteredPantryItems.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';
import { AddDerivedItemsToShoppingListDocument } from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { removeGoneNotification } from '#features/notifications/offline/replayReconcilers';
import {
  DeleteNotificationDocument,
  MarkNotificationAsReadDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import type { DocumentNode } from 'graphql';
import type { ReplayReconcilerTable } from './types';

/** One table entry per copy of the batch add that mints its rows in `input.items`. */
export const forEachBatchAdd = <T>(value: T): Array<[DocumentNode, T]> =>
  [
    AddItemToShoppingListDocument,
    AddItemsToShoppingListFromRecipeDocument,
    BarcodeAddItemToShoppingListDocument,
    AddItemToShoppingListFromFilteredPantryDocument,
    AddItemToShoppingListFromPantryItemDocument,
    AddDerivedItemsToShoppingListDocument,
  ].map((document): [DocumentNode, T] => [document, value]);

export const REPLAY_RECONCILERS: ReplayReconcilerTable = byOperation([
  [CreateHomeDocument, reconcileCreateHomeReplay],
  [MoveShoppingItemToPantryDocument, reconcileMoveToPantryReplay],
  [CreatePantryItemDocument, reconcileCreatePantryItemReplay],
  [BarcodeCreatePantryItemDocument, reconcileCreatePantryItemReplay],
  ...forEachBatchAdd(reconcileShoppingBatchReplay),
  [
    CreateShoppingListItemFromRecipeIngredientDocument,
    reconcileShoppingRowReplay,
  ],
]);

/**
 * Replays a `NotFoundError` makes moot: the entry dequeues as settled and the
 * handler removes the gone row, with no withdrawal toast.
 */
export const GONE_REPLAYS: ReplayReconcilerTable = byOperation([
  [MarkNotificationAsReadDocument, removeGoneNotification],
  [DeleteNotificationDocument, removeGoneNotification],
]);
