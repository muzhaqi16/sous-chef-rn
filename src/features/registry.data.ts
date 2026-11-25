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
  MarkSuggestionActiveDocument,
  MarkSuggestionDismissedDocument,
} from '#operations/item/item.generated';
import {
  AddDietaryRestrictionDocument,
  RemoveDietaryRestrictionDocument,
  UpdateDietaryProfileDocument,
} from '#operations/user/user.generated';
import { CreateHomeDocument } from '#operations/home/home.generated';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import {
  CreateStorageLocationDocument,
  DeleteStorageLocationDocument,
  MarkStorageLocationAsDefaultDocument,
  UpdateStorageLocationDocument,
} from './catalog/graphql/storageLocation.generated';
import { CreateStoreDocument } from './catalog/hooks/useCreateStore.generated';
import { createHome, markDefaultHome } from './home/offline/localWrites';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from './catalog/hooks/useUsualStoreWrites.generated';
import {
  addUsualStore,
  createLocation,
  createStore,
  dismissSuggestion,
  locationFields,
  pinUsualStore,
  removeLocation,
  removeUsualStore,
  undoDismissal,
  updateLocation,
} from './catalog/offline/localWrites';
import {
  AdjustPantryItemQuantityDocument,
  ConsumptionUnitsForPantryItemDocument,
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
  RestockUnitsForPantryItemDocument,
  UpdatePantryDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
  WastePantryItemBatchDocument,
} from './pantry/graphql/pantry.generated';
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
  DeleteMealPlanDocument,
  DeleteMealPlanItemDocument,
  UpdateMealPlanDocument,
  UpdateMealPlanItemDocument,
} from './mealPlan/graphql/mealPlan.generated';
import {
  AddTemplateItemDocument,
  CreateMealTemplateDocument,
  DeleteMealTemplateDocument,
  RemoveTemplateItemDocument,
  UpdateMealTemplateDocument,
  UpdateTemplateItemDocument,
} from './mealPlan/graphql/mealTemplate.generated';
import {
  addTemplateItem,
  createPlan,
  createPlanItem,
  createTemplate,
  removePlan,
  removePlanItem,
  removeTemplate,
  removeTemplateItem,
} from './mealPlan/offline/localWrites';
import { RecordPantryStockCheckDocument } from './pantry/hooks/useStockCheck.generated';
import {
  addStock,
  createItem,
  createPantry,
  discardExpired,
  drawStock,
  recordStockCheck,
  removeItem,
  removePantry,
  setStock,
  updatePantryRow,
} from './pantry/offline/localWrites';
import {
  AddRecipeToFavoritesDocument,
  CreateRecipeDocument,
  DeleteRecipeDocument,
  DeleteRecipeFolderDocument,
  ForkRecipeDocument,
  MarkRecipeAsCookedDocument,
  RemoveRecipeFromFavoritesDocument,
  UpdateFavoriteRecipeDocument,
  UpdateRecipeDocument,
} from './recipes/graphql/recipe.generated';
import {
  DeleteMultipleNotificationsDocument,
  MarkAllNotificationsAsReadDocument,
} from './notifications/graphql/bulkNotificationMutations.generated';
import {
  DeleteNotificationDocument,
  MarkNotificationAsReadDocument,
} from './notifications/graphql/notificationMutations.generated';
import {
  markAllRead,
  markRead,
  removeNotifications,
} from './notifications/offline/localWrites';
import {
  AddBrandToListDocument,
  CreateBrandListDocument,
  DeleteBrandListDocument,
  RemoveBrandFromListDocument,
  UpdateBrandListDocument,
} from './profile/hooks/useBrandLists.generated';
import { UpdateDietarySharingDocument } from './profile/hooks/useDietarySharing.generated';
import {
  addBrand,
  addRestriction,
  createBrandList,
  dietaryProfileFields,
  removeBrand,
  removeBrandList,
  removeRestriction,
} from './profile/offline/localWrites';
import { CreateReceiptCheckInDocument } from './receipts/hooks/useReceiptCheckIn.generated';
import { checkIn } from './receipts/offline/localWrites';
import {
  addFavorite,
  cookRecipe,
  createRecipe,
  moveFolder,
  removeFavorite,
  removeRecipe,
  savedFields,
} from './recipes/offline/localWrites';
import { withCurrentMealVersion } from './recipes/offline/cookReplay';
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
  RemoveItemFromShoppingListDocument,
  RemoveItemsFromShoppingListDocument,
  UpdateShoppingListDocument,
  UpdateShoppingListItemDocument,
  UpdateShoppingListReminderDocument,
} from './shoppingList/graphql/shoppingList.generated';
import {
  addRows,
  createList,
  moveToPantry,
  removeList,
  removeRows,
  updateRow,
} from '#entities/shoppingList/localWrites';
import { entityFields } from '#apollo/pendingWrites/entityFields';
import type { LocalWrite } from '#apollo/pendingWrites/types';
import {
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
import type { ReplayReconciler } from '#apollo/offlineQueue/types';
import { preparePantryItemCreate } from './pantry/offline/replayPreparers';
import {
  asQueued,
  withCurrentUnits,
  type ReplayPreparer,
} from '#apollo/offlineQueue/replayPreparation';

type ByOperation<T> = ReadonlyArray<readonly [DocumentNode, T]>;

/** Each feature's local-first writes; the kernel adds its own. */
export const FEATURE_LOCAL_WRITES: ByOperation<LocalWrite> = [
  [
    AddItemToShoppingListDocument,
    { ...addRows, subject: { key: 'items', mints: true } },
  ],
  [CreateShoppingListDocument, createList],
  [DeleteShoppingListDocument, removeList],
  [UpdateShoppingListItemDocument, updateRow],
  [
    RemoveItemFromShoppingListDocument,
    { ...removeRows, subject: { deletes: true } },
  ],
  [RemoveItemsFromShoppingListDocument, removeRows],
  [UpdateShoppingListDocument, entityFields],
  [CompleteShoppingListDocument, entityFields],
  [MarkShoppingListActiveDocument, entityFields],
  [MarkShoppingListAsDefaultDocument, entityFields],
  [MarkAsTemplateDocument, entityFields],
  [CreateRecurringShoppingListDocument, entityFields],
  [CancelRecurringDocument, entityFields],
  [UpdateShoppingListReminderDocument, entityFields],
  [DeleteShoppingListReminderDocument, entityFields],
  [
    MoveShoppingItemToPantryDocument,
    { ...moveToPantry, subject: { key: 'pantryItemId', mints: true } },
  ],
  [CreatePantryItemDocument, createItem],
  [UpdatePantryItemDocument, updatePantryRow],
  [
    UpdatePantryItemQuantityDocument,
    { ...setStock, subject: { key: 'pantryItemId' } },
  ],
  [AdjustPantryItemQuantityDocument, setStock],
  [
    RecordPantryStockCheckDocument,
    {
      ...recordStockCheck,
      subject: { key: 'entries', rowKey: 'pantryItemId' },
    },
  ],
  [DeletePantryItemDocument, removeItem],
  [
    CreatePantryItemUsageDocument,
    { ...drawStock, subject: { key: 'pantryItemId' } },
  ],
  [MarkRecipeAsCookedDocument, cookRecipe],
  [RestockPantryItemDocument, addStock],
  [
    ConvertExpiredToWasteDocument,
    { ...discardExpired, subject: { key: 'pantryItemId' } },
  ],
  [
    OpenPantryItemBatchDocument,
    { ...entityFields, subject: { key: 'batchId' } },
  ],
  [
    WastePantryItemBatchDocument,
    { ...entityFields, subject: { key: 'batchId' } },
  ],
  [CorrectPantryItemPackageSizeDocument, entityFields],
  [CreatePantryDocument, createPantry],
  [UpdatePantryDocument, entityFields],
  [DeletePantryDocument, removePantry],
  [MarkPantryAsDefaultDocument, entityFields],
  [CreateStorageLocationDocument, createLocation],
  [UpdateStorageLocationDocument, updateLocation],
  [MarkStorageLocationAsDefaultDocument, locationFields],
  [DeleteStorageLocationDocument, removeLocation],
  [CreateStoreDocument, createStore],
  [AddUsualStoreDocument, addUsualStore],
  [UpdateUsualStoreDocument, pinUsualStore],
  [RemoveUsualStoreDocument, removeUsualStore],
  [CreateMealPlanDocument, createPlan],
  [UpdateMealPlanDocument, entityFields],
  [DeleteMealPlanDocument, removePlan],
  [CreateMealPlanItemDocument, createPlanItem],
  [UpdateMealPlanItemDocument, entityFields],
  [DeleteMealPlanItemDocument, removePlanItem],
  [CreateMealTemplateDocument, createTemplate],
  [UpdateMealTemplateDocument, entityFields],
  [DeleteMealTemplateDocument, removeTemplate],
  [AddTemplateItemDocument, { ...addTemplateItem, subject: { mints: true } }],
  [UpdateTemplateItemDocument, entityFields],
  [RemoveTemplateItemDocument, removeTemplateItem],
  [CreateRecipeDocument, createRecipe],
  [
    ForkRecipeDocument,
    { ...createRecipe, subject: { key: 'newRecipeId', mints: true } },
  ],
  [UpdateRecipeDocument, entityFields],
  [DeleteRecipeDocument, removeRecipe],
  [AddRecipeToFavoritesDocument, { ...addFavorite, subject: { mints: true } }],
  [
    RemoveRecipeFromFavoritesDocument,
    { ...removeFavorite, subject: { key: 'recipeId' } },
  ],
  [UpdateFavoriteRecipeDocument, savedFields],
  [DeleteRecipeFolderDocument, moveFolder],
  [CreateHomeDocument, createHome],
  [MarkHomeAsDefaultDocument, markDefaultHome],
  [UpdateDietaryProfileDocument, dietaryProfileFields],
  [
    AddDietaryRestrictionDocument,
    { ...addRestriction, subject: { mints: true } },
  ],
  [RemoveDietaryRestrictionDocument, removeRestriction],
  [UpdateDietarySharingDocument, entityFields],
  [CreateBrandListDocument, createBrandList],
  [UpdateBrandListDocument, { ...entityFields, keyed: true }],
  [DeleteBrandListDocument, removeBrandList],
  [AddBrandToListDocument, { ...addBrand, subject: { mints: true } }],
  [RemoveBrandFromListDocument, removeBrand],
  [MarkNotificationAsReadDocument, markRead],
  [MarkAllNotificationsAsReadDocument, markAllRead],
  [DeleteNotificationDocument, removeNotifications],
  [DeleteMultipleNotificationsDocument, removeNotifications],
  [MarkSuggestionDismissedDocument, dismissSuggestion],
  [MarkSuggestionActiveDocument, undoDismissal],
  [
    CreateReceiptCheckInDocument,
    {
      ...checkIn,
      subject: { key: 'lines', rowKey: 'pantryItemId', mints: true },
    },
  ],
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
