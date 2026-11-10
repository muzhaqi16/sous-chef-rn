import { useTranslation } from '#/i18n';
import { toastService } from '#/services/toastService';
import { useActiveShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import {
  recipeShoppingRows,
  type RecipeIngredientLine,
} from '#features/recipes/utils/recipeShoppingRows';
import { useAddRecipeRows } from './useAddRecipeRows';

/**
 * Adds what a suggested recipe lacks to the list the List tab shows, with no
 * picker: one tap from its card. Resolves true once the lines landed or
 * queued; a failure is shown.
 */
export function useAddMissingToList() {
  const { t } = useTranslation();
  const { lists } = useShoppingListsLite({ fetchPolicy: 'cache-first' });
  const listId = useActiveShoppingListId(lists);
  const addRows = useAddRecipeRows();

  return async (
    recipeId: string,
    missing: readonly RecipeIngredientLine[],
  ): Promise<boolean> => {
    const list = lists.find(candidate => candidate.id === listId);
    if (!list) {
      toastService.error(t('recipes.shoppingListNotFound'));
      return false;
    }
    const rows = recipeShoppingRows(recipeId, missing, {
      unnamed: t('recipes.unnamedIngredient'),
    });
    if (rows.length === 0) {
      toastService.error(t('recipes.noIngredientsToAdd'));
      return false;
    }
    const fallback = t('recipes.addIngredientsToListFailed');
    const { added, updated, failed } = await addRows(list.id, rows, fallback);
    if (failed) return false;
    if (added + updated === 0) {
      toastService.error(fallback);
      return false;
    }
    toastService.success(
      t('recipes.addedItemsToList', { count: added, listName: list.name }),
    );
    return true;
  };
}
