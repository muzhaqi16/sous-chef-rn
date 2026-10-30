/**
 * Every feature that settles its own replay, keyed by the operation its
 * document declares. See {@link REPLAY_PREPARATIONS} for why this is a list
 * here rather than a manifest field.
 */
import { byOperation } from '#/apollo/utils/documentOperation';
import { reconcileCreateHomeReplay } from '#features/home/offline/replayReconcilers';
import {
  reconcileConvertExpiredReplay,
  reconcileCreatePantryItemReplay,
  reconcileMoveToPantryReplay,
  reconcilePantryUsageReplay,
  reconcileRestockReplay,
  settlePantryDelete,
  settlePantryItemDelete,
} from '#features/pantry/offline/replayReconcilers';
import {
  AdjustPantryItemQuantityDocument,
  ConvertExpiredToWasteDocument,
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  DeletePantryDocument,
  DeletePantryItemDocument,
  RestockPantryItemDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { ChangePantryItemUnitDocument } from '#features/pantry/hooks/usePantryUnitChange.generated';
import { CreateHomeDocument } from '#operations/home/home.generated';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { reconcileSettingsReplay } from '#/apollo/utils/unitSystemAnswers';
import {
  reconcileShoppingAddReplay,
  reconcileShoppingCreateReplay,
} from '#features/shoppingList/offline/replayReconcilers';
import {
  AddItemToShoppingListDocument,
  CreateShoppingListDocument,
  MoveShoppingItemToPantryDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { AddItemsToShoppingListFromRecipeDocument } from '#features/recipes/hooks/useRecipeShoppingList.generated';
import { AddRecipeToFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import { reconcileAddRecipeToFavoritesReplay } from '#features/recipes/offline/replayReconcilers';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/hooks/useAddPantryItemToShoppingList.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/hooks/usePantryItemDetailActions.generated';
import { AddDerivedItemsToShoppingListDocument } from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import {
  CreateMealPlanItemDocument,
  DeleteMealPlanDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { DeleteMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  reconcileCreateMealPlanItemReplay,
  settleGoneMealPlanItem,
  settleMealPlanDelete,
  settleMealTemplateDelete,
} from '#features/mealPlan/offline/replayReconcilers';
import { removeGoneNotification } from '#features/notifications/offline/replayReconcilers';
import { reconcileReceiptCheckInReplay } from '#features/receipts/offline/receiptCheckIn';
import { CreateReceiptCheckInDocument } from '#features/receipts/hooks/useReceiptCheckIn.generated';
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
  [AddRecipeToFavoritesDocument, reconcileAddRecipeToFavoritesReplay],
  [CreateHomeDocument, reconcileCreateHomeReplay],
  [CreateMealPlanItemDocument, reconcileCreateMealPlanItemReplay],
  [DeleteMealPlanDocument, settleMealPlanDelete],
  // A replayed delete answers `converged` as a success, not as not-found.
  [DeleteMealPlanItemDocument, settleGoneMealPlanItem],
  [DeleteMealTemplateDocument, settleMealTemplateDelete],
  [MoveShoppingItemToPantryDocument, reconcileMoveToPantryReplay],
  [CreatePantryItemDocument, reconcileCreatePantryItemReplay],
  // A delta against a stack merged since lands on the survivor (USM-3).
  [CreatePantryItemUsageDocument, reconcilePantryUsageReplay],
  [RestockPantryItemDocument, reconcileRestockReplay],
  [ConvertExpiredToWasteDocument, reconcileConvertExpiredReplay],
  [CreateReceiptCheckInDocument, reconcileReceiptCheckInReplay],
  [DeletePantryItemDocument, settlePantryItemDelete],
  [DeletePantryDocument, settlePantryDelete],
  ...forEachBatchAdd(reconcileShoppingAddReplay),
  [CreateShoppingListDocument, reconcileShoppingCreateReplay],
  [UpdateUserPreferencesDocument, reconcileSettingsReplay],
]);

/**
 * Replays a `NotFoundError` makes moot: the entry dequeues as settled and the
 * handler removes the gone row, with no withdrawal toast. A removal the server
 * already applied answers `converged` as a success and never reaches here.
 */
export const GONE_REPLAYS: ReplayReconcilerTable = byOperation([
  [MarkNotificationAsReadDocument, removeGoneNotification],
  [DeleteNotificationDocument, removeGoneNotification],
  [DeleteMealPlanItemDocument, settleGoneMealPlanItem],
]);

const always = (): boolean => true;
const setsQuantityOrUnit = (input: Record<string, unknown>): boolean =>
  input.quantity !== undefined || input.unit !== undefined;

/**
 * Writes that overwrite the quantity a merged create combined. Moved onto the
 * surviving entry they would replace amounts the person never saw, so they are
 * withdrawn as conflicts instead; a delta (a usage, a restock) is not listed.
 */
export const MERGED_QUANTITY_OVERWRITES: Record<
  string,
  (input: Record<string, unknown>) => boolean
> = byOperation([
  [UpdatePantryItemQuantityDocument, always],
  [AdjustPantryItemQuantityDocument, always],
  [ChangePantryItemUnitDocument, always],
  [UpdatePantryItemDocument, setsQuantityOrUnit],
  [UpdateShoppingListItemDocument, setsQuantityOrUnit],
]);
