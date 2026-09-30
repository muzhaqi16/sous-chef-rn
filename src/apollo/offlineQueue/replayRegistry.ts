/**
 * Every feature that settles its own replay, keyed by the operation its
 * document declares. See {@link REPLAY_PREPARATIONS} for why this is a list
 * here rather than a manifest field.
 */
import { byOperation } from '#/apollo/utils/documentOperation';
import { reconcileCreateHomeReplay } from '#features/home/offline/replayReconcilers';
import {
  reconcileCreatePantryItemReplay,
  reconcileMoveToPantryReplay,
  settlePantryDelete,
  settlePantryItemDelete,
} from '#features/pantry/offline/replayReconcilers';
import {
  AdjustPantryItemQuantityDocument,
  CreatePantryItemDocument,
  DeletePantryDocument,
  DeletePantryItemDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { ChangePantryItemUnitDocument } from '#features/pantry/hooks/usePantryUnitChange.generated';
import { CreateHomeDocument } from '#operations/home/home.generated';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { reconcileSettingsReplay } from '#/apollo/utils/unitSystemAnswers';
import {
  reconcileShoppingAddReplay,
  reconcileShoppingRowReplay,
  settleShoppingItemDelete,
} from '#features/shoppingList/offline/replayReconcilers';
import {
  AddItemToShoppingListDocument,
  MoveShoppingItemToPantryDocument,
  RemoveItemFromShoppingListDocument,
  UpdateShoppingListItemDocument,
  UpdateShoppingListItemQuantityDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { AddItemsToShoppingListFromRecipeDocument } from '#features/recipes/hooks/useRecipeDetail.generated';
import {
  AddRecipeToFavoritesDocument,
  CreateShoppingListItemFromRecipeIngredientDocument,
} from '#features/recipes/graphql/recipe.generated';
import { reconcileAddRecipeToFavoritesReplay } from '#features/recipes/offline/replayReconcilers';
import {
  BarcodeAddItemToShoppingListDocument,
  BarcodeCreatePantryItemDocument,
} from '#features/barcode/hooks/useAddScannedItem.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/screens/FilteredPantryItems.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';
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
  [DeleteMealTemplateDocument, settleMealTemplateDelete],
  [MoveShoppingItemToPantryDocument, reconcileMoveToPantryReplay],
  [CreatePantryItemDocument, reconcileCreatePantryItemReplay],
  [BarcodeCreatePantryItemDocument, reconcileCreatePantryItemReplay],
  [DeletePantryItemDocument, settlePantryItemDelete],
  [DeletePantryDocument, settlePantryDelete],
  ...forEachBatchAdd(reconcileShoppingAddReplay),
  [RemoveItemFromShoppingListDocument, settleShoppingItemDelete],
  [
    CreateShoppingListItemFromRecipeIngredientDocument,
    reconcileShoppingRowReplay,
  ],
  [UpdateUserPreferencesDocument, reconcileSettingsReplay],
]);

/**
 * Replays a `NotFoundError` makes moot: the entry dequeues as settled and the
 * handler removes the gone row, with no withdrawal toast.
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
  [UpdateShoppingListItemQuantityDocument, always],
  [AdjustPantryItemQuantityDocument, always],
  [ChangePantryItemUnitDocument, always],
  [UpdatePantryItemDocument, setsQuantityOrUnit],
  [UpdateShoppingListItemDocument, setsQuantityOrUnit],
]);
