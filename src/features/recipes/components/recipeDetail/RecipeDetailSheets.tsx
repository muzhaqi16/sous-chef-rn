import React from 'react';
import { startingServings } from '#domain/servings';
import { ReportContentSheet } from '#features/profile/ui/ReportContentSheet';
import { useCooksFor } from '#features/profile/hooks/useCooksFor';
import { ManageRecipeSheet } from '#features/recipes/components/modals/ManageRecipeSheet/ManageRecipeSheet';
import { SaveRecipeSheet } from '#features/recipes/components/modals/SaveRecipeSheet/SaveRecipeSheet';
import { useRecipeFolders } from '#features/recipes/hooks/useRecipeFolders';
import type { useRecipeDietaryAlerts } from '#features/recipes/hooks/useRecipeDietaryAlerts';
import { useRecipeSubstitutes } from '#features/recipes/hooks/useRecipeSubstitutes';
import type { RecipeDetailState } from '#features/recipes/screens/RecipeDetail/useRecipeDetail';
import type { RecipeSheetsState } from '#features/recipes/screens/RecipeDetail/useRecipeDetailSheets';
import { useRecipeTags } from '#features/recipes/screens/useRecipeTags';
import { RecipeCookFlow } from '#features/recipes/ui/RecipeCookFlow';
import { ShoppingListPickerSheet } from '#features/shoppingList/ui/ShoppingListPickerSheet';
import { IngredientAlertsSheet } from './IngredientAlertsSheet';

interface RecipeDetailSheetsProps {
  detail: RecipeDetailState;
  sheets: RecipeSheetsState;
  household: ReturnType<typeof useRecipeDietaryAlerts>;
  title: string;
  servings: number | null | undefined;
  /** The meal plan's own sheet, reached through its public hook. */
  mealPlanSheet: React.ReactNode;
}

/** Every sheet the recipe screen opens. */
export const RecipeDetailSheets: React.FC<RecipeDetailSheetsProps> = ({
  detail,
  sheets,
  household,
  title,
  servings,
  mealPlanSheet,
}) => {
  const { folders } = useRecipeFolders();
  const { tags: availableTags } = useRecipeTags();
  const cooksFor = useCooksFor();
  // Swaps are offered where the household flags an ingredient.
  const substitutes = useRecipeSubstitutes(detail.recipeId, household.flagged);
  const { active, close } = sheets;
  const flagged = active?.type === 'ingredient' ? active.ingredient : null;

  return (
    <>
      <ShoppingListPickerSheet
        visible={detail.listPickerVisible}
        shoppingLists={detail.shoppingLists}
        listsState={detail.shoppingListsState}
        onRetryLists={detail.retryShoppingLists}
        defaultNewListName={title}
        creatingList={detail.creatingList}
        onListSelected={detail.handleListSelected}
        onCreateListAndAdd={detail.handleCreateListAndAddIngredients}
        onDismiss={detail.handleSheetDismiss}
      />

      <RecipeCookFlow
        visible={detail.cookedModalVisible}
        onClose={() => detail.setCookedModalVisible(false)}
        cooking={{
          handleMarkAsCooked: detail.handleMarkAsCooked,
          handleSkipReview: detail.handleSkipReview,
          handleConfirmReview: detail.handleConfirmReview,
          handleRecordWithoutDeducting: detail.handleRecordWithoutDeducting,
          ingredientMatching: detail.ingredientMatching,
        }}
        recipeName={title}
        defaultServings={startingServings(
          cooksFor,
          servings === 0 ? 1 : servings ?? 1,
        )}
      />

      <SaveRecipeSheet
        visible={active?.type === 'save'}
        onClose={close}
        folders={folders}
        availableTags={availableTags}
        onSave={async options => {
          detail.handleSaveRecipe(
            options.folder ?? null,
            options.tags,
            options.notes,
          );
          close();
        }}
        saving={detail.saving}
        recipeName={title}
      />

      {mealPlanSheet}

      <ManageRecipeSheet
        visible={active?.type === 'manage'}
        onClose={close}
        folders={folders}
        availableTags={availableTags}
        currentFolder={detail.savedFolder}
        currentTags={detail.savedTags}
        currentNotes={detail.savedNotes}
        currentRating={detail.savedRating}
        onUpdateFolder={detail.handleUpdateFolder}
        onUpdateTags={detail.handleUpdateTags}
        onUpdateNotes={detail.handleUpdateNotes}
        onUpdateRating={detail.handleUpdateRating}
        onRemove={detail.handleUnfavoriteRecipe}
        updating={detail.updatingFolderTags}
        recipeName={title}
      />

      <ReportContentSheet
        visible={active?.type === 'report'}
        target={active?.type === 'report' ? active.target : null}
        onDismiss={close}
      />

      <IngredientAlertsSheet
        visible={!!flagged}
        ingredientName={flagged?.name ?? ''}
        alerts={flagged ? household.alertsFor(flagged.id) : []}
        stale={household.check === 'stale'}
        options={flagged ? substitutes.substitutesFor(flagged.id) : []}
        isAdded={!!flagged && detail.listedIngredients.has(flagged.id)}
        onAdd={() => {
          if (flagged) void detail.handleAddSingleIngredient(flagged);
        }}
        onDismiss={close}
      />
    </>
  );
};
