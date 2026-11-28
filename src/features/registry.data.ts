/**
 * Every feature's part in the write kernel: its local-first writes, and how
 * the queue restates and settles its replays. The kernel's registries key it
 * by operation (`localWriteRegistry`, `preparationRegistry`,
 * `replayRegistry`). Its own list, not a manifest field, for the reason
 * `registry.cache.ts` gives (`launchPathWeight.test.ts`). Nothing here may
 * reach back into those registries: they import this at load.
 */
import type { DocumentNode } from 'graphql';
import {
  AdjustPantryItemQuantityDocument,
  ConsumptionUnitsForPantryItemDocument,
  ConvertExpiredToWasteDocument,
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  DeletePantryItemDocument,
  RestockPantryItemDocument,
  RestockUnitsForPantryItemDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from './pantry/graphql/pantry.generated';
import {
  CreateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
} from './mealPlan/graphql/mealPlan.generated';
import { RecordPantryStockCheckDocument } from './pantry/hooks/useStockCheck.generated';
import { MarkRecipeAsCookedDocument } from './recipes/graphql/recipe.generated';
import {
  DeleteNotificationDocument,
  MarkNotificationAsReadDocument,
} from './notifications/graphql/notificationMutations.generated';
import { CreateReceiptCheckInDocument } from './receipts/hooks/useReceiptCheckIn.generated';
import { withCurrentMealVersion } from './recipes/offline/cookReplay';
import {
  AddItemToShoppingListDocument,
  CreateShoppingListDocument,
  MoveShoppingItemToPantryDocument,
  RemoveItemFromShoppingListDocument,
  UpdateShoppingListItemDocument,
} from './shoppingList/graphql/shoppingList.generated';
import {
  keepRefusedStockCheckRows,
  reconcileConvertExpiredReplay,
  reconcileCreatePantryItemReplay,
  reconcileMoveToPantryReplay,
  reconcilePantryUsageReplay,
  reconcileRestockReplay,
} from './pantry/offline/replayReconcilers';
import { ChangePantryItemUnitDocument } from './pantry/hooks/usePantryUnitChange.generated';
import {
  reconcileShoppingAddReplay,
  reconcileShoppingCreateReplay,
} from './shoppingList/offline/replayReconcilers';
import {
  reconcileCreateMealPlanItemReplay,
  settleGoneMealPlanItem,
} from './mealPlan/offline/replayReconcilers';
import { removeGoneNotification } from './notifications/offline/replayReconcilers';
import { reconcileReceiptCheckInReplay } from './receipts/offline/receiptCheckIn';
import type {
  RefusedRowsNarrower,
  ReplayReconciler,
} from '#apollo/offlineQueue/types';
import {
  preparePantryItemCreate,
  retryStockCheckAsItStands,
} from './pantry/offline/replayPreparers';
import {
  asQueued,
  withCurrentUnits,
  type ReplayPreparer,
} from '#apollo/offlineQueue/replayPreparation';
import {
  addUsualStoreWrite,
  createStorageLocationWrite,
  createStoreWrite,
  deleteStorageLocationWrite,
  markStorageLocationAsDefaultWrite,
  markSuggestionActiveWrite,
  markSuggestionDismissedWrite,
  removeUsualStoreWrite,
  updateStorageLocationWrite,
  updateUsualStoreWrite,
} from './catalog/offline/localWrites';
import {
  createHomeWrite,
  markHomeAsDefaultWrite,
} from './home/offline/localWrites';
import {
  addTemplateItemWrite,
  createMealPlanItemWrite,
  createMealPlanWrite,
  createMealTemplateWrite,
  deleteMealPlanItemWrite,
  deleteMealPlanWrite,
  deleteMealTemplateWrite,
  removeTemplateItemWrite,
  updateMealPlanItemWrite,
  updateMealPlanWrite,
  updateMealTemplateWrite,
  updateTemplateItemWrite,
} from './mealPlan/offline/localWrites';
import {
  deleteMultipleNotificationsWrite,
  deleteNotificationWrite,
  markAllNotificationsAsReadWrite,
  markNotificationAsReadWrite,
} from './notifications/offline/localWrites';
import {
  adjustPantryItemQuantityWrite,
  convertExpiredToWasteWrite,
  correctPantryItemPackageSizeWrite,
  createPantryItemUsageWrite,
  createPantryItemWrite,
  createPantryWrite,
  deletePantryItemWrite,
  deletePantryWrite,
  markPantryAsDefaultWrite,
  openPantryItemBatchWrite,
  recordPantryStockCheckWrite,
  restockPantryItemWrite,
  updatePantryItemQuantityWrite,
  updatePantryItemWrite,
  updatePantryWrite,
  wastePantryItemBatchWrite,
} from './pantry/offline/localWrites';
import {
  addBrandToListWrite,
  addDietaryRestrictionWrite,
  createBrandListWrite,
  deleteBrandListWrite,
  removeBrandFromListWrite,
  removeDietaryRestrictionWrite,
  updateBrandListWrite,
  updateDietaryProfileWrite,
  updateDietarySharingWrite,
} from './profile/offline/localWrites';
import { createReceiptCheckInWrite } from './receipts/offline/localWrites';
import {
  addRecipeToFavoritesWrite,
  createRecipeWrite,
  deleteRecipeFolderWrite,
  deleteRecipeWrite,
  forkRecipeWrite,
  markRecipeAsCookedWrite,
  removeRecipeFromFavoritesWrite,
  updateFavoriteRecipeWrite,
  updateRecipeWrite,
} from './recipes/offline/localWrites';
import {
  addItemToShoppingListWrite,
  cancelRecurringWrite,
  completeShoppingListWrite,
  createRecurringShoppingListWrite,
  createShoppingListWrite,
  deleteShoppingListReminderWrite,
  deleteShoppingListWrite,
  markAsTemplateWrite,
  markShoppingListActiveWrite,
  markShoppingListAsDefaultWrite,
  moveShoppingItemToPantryWrite,
  removeItemFromShoppingListWrite,
  removeItemsFromShoppingListWrite,
  updateShoppingListItemWrite,
  updateShoppingListReminderWrite,
  updateShoppingListWrite,
} from './shoppingList/offline/localWrites';
import type { RegisteredBinding } from '#apollo/pendingWrites/types';

type ByOperation<T> = ReadonlyArray<readonly [DocumentNode, T]>;

/** Each feature's local-first writes, as the bindings its hooks send; the kernel adds its own. */
export const FEATURE_LOCAL_WRITES: readonly RegisteredBinding[] = [
  addItemToShoppingListWrite,
  createShoppingListWrite,
  deleteShoppingListWrite,
  updateShoppingListItemWrite,
  removeItemFromShoppingListWrite,
  removeItemsFromShoppingListWrite,
  updateShoppingListWrite,
  completeShoppingListWrite,
  markShoppingListActiveWrite,
  markShoppingListAsDefaultWrite,
  markAsTemplateWrite,
  createRecurringShoppingListWrite,
  cancelRecurringWrite,
  updateShoppingListReminderWrite,
  deleteShoppingListReminderWrite,
  moveShoppingItemToPantryWrite,
  createPantryItemWrite,
  updatePantryItemWrite,
  updatePantryItemQuantityWrite,
  adjustPantryItemQuantityWrite,
  recordPantryStockCheckWrite,
  deletePantryItemWrite,
  createPantryItemUsageWrite,
  markRecipeAsCookedWrite,
  restockPantryItemWrite,
  convertExpiredToWasteWrite,
  openPantryItemBatchWrite,
  wastePantryItemBatchWrite,
  correctPantryItemPackageSizeWrite,
  createPantryWrite,
  updatePantryWrite,
  deletePantryWrite,
  markPantryAsDefaultWrite,
  createStorageLocationWrite,
  updateStorageLocationWrite,
  markStorageLocationAsDefaultWrite,
  deleteStorageLocationWrite,
  createStoreWrite,
  addUsualStoreWrite,
  updateUsualStoreWrite,
  removeUsualStoreWrite,
  createMealPlanWrite,
  updateMealPlanWrite,
  deleteMealPlanWrite,
  createMealPlanItemWrite,
  updateMealPlanItemWrite,
  deleteMealPlanItemWrite,
  createMealTemplateWrite,
  updateMealTemplateWrite,
  deleteMealTemplateWrite,
  addTemplateItemWrite,
  updateTemplateItemWrite,
  removeTemplateItemWrite,
  createRecipeWrite,
  forkRecipeWrite,
  updateRecipeWrite,
  deleteRecipeWrite,
  addRecipeToFavoritesWrite,
  removeRecipeFromFavoritesWrite,
  updateFavoriteRecipeWrite,
  deleteRecipeFolderWrite,
  createHomeWrite,
  markHomeAsDefaultWrite,
  updateDietaryProfileWrite,
  addDietaryRestrictionWrite,
  removeDietaryRestrictionWrite,
  updateDietarySharingWrite,
  createBrandListWrite,
  updateBrandListWrite,
  deleteBrandListWrite,
  addBrandToListWrite,
  removeBrandFromListWrite,
  markNotificationAsReadWrite,
  markAllNotificationsAsReadWrite,
  deleteNotificationWrite,
  deleteMultipleNotificationsWrite,
  markSuggestionDismissedWrite,
  markSuggestionActiveWrite,
  createReceiptCheckInWrite,
];

/**
 * Operations the queue replays without a `localFirst` opt-in, with what each
 * restates.
 */
export const FEATURE_REPLAY_PREPARATIONS: ByOperation<ReplayPreparer> = [
  [CreatePantryItemDocument, preparePantryItemCreate],
  [UpdatePantryItemDocument, withCurrentUnits],
  [UpdatePantryItemQuantityDocument, withCurrentUnits],
  [DeletePantryItemDocument, asQueued],
  [AddItemToShoppingListDocument, withCurrentUnits],
  [UpdateShoppingListItemDocument, withCurrentUnits],
  [RemoveItemFromShoppingListDocument, asQueued],
  [MarkRecipeAsCookedDocument, withCurrentMealVersion],
  [RecordPantryStockCheckDocument, retryStockCheckAsItStands],
];

/** Batches whose refused rows become a write of their own. */
export const FEATURE_REFUSED_ROWS: ByOperation<RefusedRowsNarrower> = [
  [RecordPantryStockCheckDocument, keepRefusedStockCheckRows],
];

/** Replays whose answer may name a stack merged since they were queued. */
export const FEATURE_MERGE_REPORTERS: ByOperation<ReplayReconciler> = [
  [CreateMealPlanItemDocument, reconcileCreateMealPlanItemReplay],
  [MoveShoppingItemToPantryDocument, reconcileMoveToPantryReplay],
  [CreatePantryItemDocument, reconcileCreatePantryItemReplay],
  // A delta against a stack merged since lands on the survivor (USM-3).
  [CreatePantryItemUsageDocument, reconcilePantryUsageReplay],
  [RestockPantryItemDocument, reconcileRestockReplay],
  [ConvertExpiredToWasteDocument, reconcileConvertExpiredReplay],
  [AddItemToShoppingListDocument, reconcileShoppingAddReplay],
  [CreateShoppingListDocument, reconcileShoppingCreateReplay],
];

/** Also settles the receipt's lines, which a check-in's own answer does online. */
export const FEATURE_SETTLED_REPLAYS: ByOperation<ReplayReconciler> = [
  [CreateReceiptCheckInDocument, reconcileReceiptCheckInReplay],
];

/**
 * Replays a `NotFoundError` makes moot: the entry dequeues as settled and the
 * handler removes the gone row, with no withdrawal toast. A removal the server
 * already applied answers `converged` as a success and never reaches here.
 */
export const FEATURE_GONE_REPLAYS: ByOperation<ReplayReconciler> = [
  [MarkNotificationAsReadDocument, removeGoneNotification],
  [DeleteNotificationDocument, removeGoneNotification],
  [DeleteMealPlanItemDocument, settleGoneMealPlanItem],
];

const always = (): boolean => true;
const setsQuantityOrUnit = (input: Record<string, unknown>): boolean =>
  input.quantity !== undefined || input.unit !== undefined;

/**
 * Writes that overwrite the quantity a merged create combined. Moved onto the
 * surviving entry they would replace amounts the person never saw, so they are
 * withdrawn as conflicts instead; a delta (a usage, a restock) is not listed.
 */
export const FEATURE_QUANTITY_OVERWRITES: ByOperation<
  (input: Record<string, unknown>) => boolean
> = [
  [UpdatePantryItemQuantityDocument, always],
  [AdjustPantryItemQuantityDocument, always],
  [ChangePantryItemUnitDocument, always],
  [UpdatePantryItemDocument, setsQuantityOrUnit],
  [UpdateShoppingListItemDocument, setsQuantityOrUnit],
];

/**
 * Feature queries whose root field answers with `Unit` rows, which the queue
 * evicts with the shared unit lookups when the unit vocabulary is refreshed.
 */
export const FEATURE_UNIT_QUERIES: readonly DocumentNode[] = [
  ConsumptionUnitsForPantryItemDocument,
  RestockUnitsForPantryItemDocument,
];
