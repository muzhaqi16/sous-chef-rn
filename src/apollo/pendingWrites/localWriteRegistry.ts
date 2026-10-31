import { byOperation } from '#/apollo/utils/documentOperation';
import {
  MarkSuggestionActiveDocument,
  MarkSuggestionDismissedDocument,
} from '#operations/item/item.generated';
import { settingsFields } from '#/apollo/utils/unitSystemAnswers';
import {
  CompleteOnboardingDocument,
  UpdateUserPreferencesDocument,
  UpdateUserProfileDocument,
} from '#operations/auth/user.generated';
import {
  RemoveDietaryRestrictionDocument,
  UpdateDietaryProfileDocument,
  UpdateNotificationPreferencesDocument,
} from '#operations/user/user.generated';
import {
  CreateHomeDocument,
  UpdateHomeDocument,
} from '#operations/home/home.generated';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import {
  CreateStorageLocationDocument,
  DeleteStorageLocationDocument,
  MarkStorageLocationAsDefaultDocument,
  UpdateStorageLocationDocument,
} from '#features/catalog/graphql/storageLocation.generated';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import {
  createHome,
  markDefaultHome,
} from '#features/home/offline/localWrites';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from '#features/catalog/hooks/useUsualStoreWrites.generated';
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
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
  DeleteMealPlanDocument,
  DeleteMealPlanItemDocument,
  UpdateMealPlanDocument,
  UpdateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  AddTemplateItemDocument,
  CreateMealTemplateDocument,
  DeleteMealTemplateDocument,
  RemoveTemplateItemDocument,
  UpdateMealTemplateDocument,
  UpdateTemplateItemDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { AddDerivedItemsToShoppingListDocument } from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import {
  addTemplateItem,
  createPlan,
  createPlanItem,
  createTemplate,
  removePlan,
  removePlanItem,
  removeTemplate,
  removeTemplateItem,
} from '#features/mealPlan/offline/localWrites';
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
import {
  AddRecipeToFavoritesDocument,
  CreateRecipeDocument,
  DeleteRecipeDocument,
  DeleteRecipeFolderDocument,
  ForkRecipeDocument,
  RemoveRecipeFromFavoritesDocument,
  UpdateFavoriteRecipeDocument,
  UpdateRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  DeleteMultipleNotificationsDocument,
  MarkAllNotificationsAsReadDocument,
} from '#features/notifications/graphql/bulkNotificationMutations.generated';
import {
  DeleteNotificationDocument,
  MarkNotificationAsReadDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import {
  markAllRead,
  markRead,
  removeNotifications,
} from '#features/notifications/offline/localWrites';
import {
  AddBrandToListDocument,
  CreateBrandListDocument,
  DeleteBrandListDocument,
  RemoveBrandFromListDocument,
  UpdateBrandListDocument,
} from '#features/profile/hooks/useBrandLists.generated';
import { UpdateDietarySharingDocument } from '#features/profile/hooks/useDietarySharing.generated';
import {
  addBrand,
  createBrandList,
  removeBrand,
  removeBrandList,
  removeRestriction,
} from '#features/profile/offline/localWrites';
import { CreateReceiptCheckInDocument } from '#features/receipts/hooks/useReceiptCheckIn.generated';
import { checkIn } from '#features/receipts/offline/localWrites';
import { AddItemsToShoppingListFromRecipeDocument } from '#features/recipes/hooks/useRecipeShoppingList.generated';
import {
  addFavorite,
  createRecipe,
  moveFolder,
  removeFavorite,
  removeRecipe,
  savedFields,
} from '#features/recipes/offline/localWrites';
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
  [CreateMealPlanDocument, createPlan],
  [UpdateMealPlanDocument, entityFields],
  [DeleteMealPlanDocument, removePlan],
  [CreateMealPlanItemDocument, createPlanItem],
  [UpdateMealPlanItemDocument, entityFields],
  [DeleteMealPlanItemDocument, removePlanItem],
  [CreateMealTemplateDocument, createTemplate],
  [UpdateMealTemplateDocument, entityFields],
  [DeleteMealTemplateDocument, removeTemplate],
  [AddTemplateItemDocument, addTemplateItem],
  [UpdateTemplateItemDocument, entityFields],
  [RemoveTemplateItemDocument, removeTemplateItem],
  [CreateRecipeDocument, createRecipe],
  [ForkRecipeDocument, createRecipe],
  [UpdateRecipeDocument, entityFields],
  [DeleteRecipeDocument, removeRecipe],
  [AddRecipeToFavoritesDocument, addFavorite],
  [RemoveRecipeFromFavoritesDocument, removeFavorite],
  [UpdateFavoriteRecipeDocument, savedFields],
  [DeleteRecipeFolderDocument, moveFolder],
  [CreateHomeDocument, createHome],
  [UpdateHomeDocument, entityFields],
  [MarkHomeAsDefaultDocument, markDefaultHome],
  [UpdateUserPreferencesDocument, settingsFields],
  [UpdateNotificationPreferencesDocument, entityFields],
  [CompleteOnboardingDocument, entityFields],
  [UpdateUserProfileDocument, entityFields],
  [UpdateDietaryProfileDocument, entityFields],
  [RemoveDietaryRestrictionDocument, removeRestriction],
  [UpdateDietarySharingDocument, entityFields],
  [CreateBrandListDocument, createBrandList],
  [UpdateBrandListDocument, entityFields],
  [DeleteBrandListDocument, removeBrandList],
  [AddBrandToListDocument, addBrand],
  [RemoveBrandFromListDocument, removeBrand],
  [MarkNotificationAsReadDocument, markRead],
  [MarkAllNotificationsAsReadDocument, markAllRead],
  [DeleteNotificationDocument, removeNotifications],
  [DeleteMultipleNotificationsDocument, removeNotifications],
  [MarkSuggestionDismissedDocument, dismissSuggestion],
  [MarkSuggestionActiveDocument, undoDismissal],
  [CreateReceiptCheckInDocument, checkIn],
]);
