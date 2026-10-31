import { LOCAL_WRITES } from '#/apollo/pendingWrites/localWriteRegistry';
import {
  authoredMutations,
  localFirstOperationNames,
} from '#/test-utils/queueableOperations';

/**
 * Sent local-first with no local write of their own, each with its reason. An
 * entry here is either still to move or truly writes nothing on the device.
 */
const STILL_TO_MOVE = 'writes the cache itself until its feature moves';

const NO_LOCAL_WRITE: Record<string, string> = {
  AddBrandToList: STILL_TO_MOVE,
  AddDietaryRestriction: STILL_TO_MOVE,
  AddRecipeToFavorites: STILL_TO_MOVE,
  AddTemplateItem: STILL_TO_MOVE,
  CompleteOnboarding: STILL_TO_MOVE,
  CreateBrandList: STILL_TO_MOVE,
  CreateHome: STILL_TO_MOVE,
  CreateMealPlan: STILL_TO_MOVE,
  CreateMealPlanItem: STILL_TO_MOVE,
  CreateMealTemplate: STILL_TO_MOVE,
  CreateReceiptCheckIn: STILL_TO_MOVE,
  CreateRecipe: STILL_TO_MOVE,
  DeleteBrandList: STILL_TO_MOVE,
  DeleteMealPlan: STILL_TO_MOVE,
  DeleteMealPlanItem: STILL_TO_MOVE,
  DeleteMealTemplate: STILL_TO_MOVE,
  DeleteMultipleNotifications: STILL_TO_MOVE,
  DeleteNotification: STILL_TO_MOVE,
  DeleteRecipe: STILL_TO_MOVE,
  DeleteRecipeFolder: STILL_TO_MOVE,
  ForkRecipe: STILL_TO_MOVE,
  MarkAllNotificationsAsRead: STILL_TO_MOVE,
  MarkExpirationAction: STILL_TO_MOVE,
  MarkHomeAsDefault: STILL_TO_MOVE,
  MarkNotificationAsRead: STILL_TO_MOVE,
  MarkRecipeAsCooked: STILL_TO_MOVE,
  MarkSuggestionActive: STILL_TO_MOVE,
  MarkSuggestionDismissed: STILL_TO_MOVE,
  MovePurchasedItemsToPantry:
    'shows nothing until answered: the server picks the lines, and the pantry reads the rows',
  RemoveBrandFromList: STILL_TO_MOVE,
  RemoveDietaryRestriction: STILL_TO_MOVE,
  RemoveRecipeFromFavorites: STILL_TO_MOVE,
  RemoveTemplateItem: STILL_TO_MOVE,
  UpdateBrandList: STILL_TO_MOVE,
  UpdateDietaryProfile: STILL_TO_MOVE,
  UpdateDietarySharing: STILL_TO_MOVE,
  UpdateFavoriteRecipe: STILL_TO_MOVE,
  UpdateHome: STILL_TO_MOVE,
  UpdateMealPlan: STILL_TO_MOVE,
  UpdateMealPlanItem: STILL_TO_MOVE,
  UpdateMealTemplate: STILL_TO_MOVE,
  UpdateNotificationPreferences: STILL_TO_MOVE,
  UpdateRecipe: STILL_TO_MOVE,
  UpdateTemplateItem: STILL_TO_MOVE,
  UpdateUserPreferences: STILL_TO_MOVE,
  UpdateUserProfile: STILL_TO_MOVE,
};

const localFirst = () => {
  const authored = authoredMutations();
  return [...localFirstOperationNames()].filter(name => authored.has(name));
};

describe('local-first operations', () => {
  it('each has a local write, or a stated reason for having none', () => {
    const uncovered = localFirst()
      .filter(name => !LOCAL_WRITES[name] && !NO_LOCAL_WRITE[name])
      .sort();

    expect(uncovered).toEqual([]);
  });

  it('keeps the reasons honest', () => {
    const operations = new Set(localFirst());
    const stale = Object.keys(NO_LOCAL_WRITE).filter(
      name => !operations.has(name) || LOCAL_WRITES[name],
    );

    expect(stale).toEqual([]);
  });
});
