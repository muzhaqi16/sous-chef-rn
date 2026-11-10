import { useState } from 'react';
import { useTranslation } from '#/i18n';
import type { MaterializedRecipe, DisplayIngredient } from './useRecipeData';
import { useAddRecipeRows } from './useAddRecipeRows';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { useActiveShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import { useAppStore } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { logger } from '#/utils/environment';
import { recipeShoppingRows } from '#features/recipes/utils/recipeShoppingRows';
import { useRecipeMissingIngredients } from './useRecipeMissingIngredients';
import { useOpenListLinesFor } from '#features/shoppingList/hooks/useOpenListLinesFor';
import { MAX_RECIPE_INGREDIENTS } from '#domain/recipeIngredientsPaging';

interface UseRecipeShoppingListOptions {
  recipeId: string | undefined;
  backendRecipe: MaterializedRecipe | null | undefined;
}

/** Every ingredient, or only those the selected home's pantries lack. */
type PendingAction = { type: 'all' } | { type: 'missing' };

export function useRecipeShoppingList({
  recipeId,
  backendRecipe,
}: UseRecipeShoppingListOptions) {
  const { t } = useTranslation();
  // A picker for the List tab's lists: the cache it keeps current answers.
  const {
    lists: shoppingLists,
    loading: shoppingListsLoading,
    state: shoppingListsState,
    refetch: refetchShoppingLists,
  } = useShoppingListsLite({ fetchPolicy: 'cache-first' });

  const targetListId = useActiveShoppingListId(shoppingLists);
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  const getShoppingListById = (listId: string | undefined) =>
    shoppingLists.find(list => list.id === listId) ?? null;

  const { createShoppingList } = useCreateShoppingList(
    t('errors.createShoppingListFailed'),
  );

  // State
  const [addingToList, setAddingToList] = useState(false);
  const [addedIngredients, setAddedIngredients] = useState<
    Set<string | number>
  >(new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [creatingList, setCreatingList] = useState(false);

  // The list picker is the only sheet — driven by `visible` through
  // useStandardBottomSheet's guarded path.
  const [listPickerVisible, setListPickerVisible] = useState(false);

  const openListPicker = (action: PendingAction) => {
    if (shoppingListsLoading) {
      toastService.info(t('recipes.loadingShoppingLists'));
      return;
    }
    setPendingAction(action);
    setListPickerVisible(true);
  };

  // One door for a single ingredient, the whole recipe and what it lacks.
  const addRows = useAddRecipeRows();

  // Add a single ingredient to the user's default/selected list (no picker).
  const handleAddSingleIngredient = async (ingredient: DisplayIngredient) => {
    if (!recipeId) {
      toastService.error(t('recipes.noIngredientsToAdd'));
      return;
    }
    const targetList = getShoppingListById(targetListId);
    if (!targetList) {
      toastService.error(t('recipes.createListFirst'));
      return;
    }

    const rows = recipeShoppingRows(recipeId, [ingredient], {
      unnamed: t('recipes.unnamedIngredient'),
      includeOptional: true,
    });
    const fallback = t('recipes.addIngredientToListFailed');
    const outcome = await addRows(targetList.id, rows, fallback);
    if (outcome.failed) return;
    if (outcome.refused.size > 0) {
      toastService.error(fallback);
      return;
    }

    setAddedIngredients(prev => new Set(prev).add(ingredient.id));
    toastService.success(
      t('recipes.addedToList', { listName: targetList.name }),
    );
  };

  // `hasNextPage` marks a recipe over the ingredient limit: the device holds
  // only its first page, which would add a short list.
  const refusesRecipeOverLimit = (): boolean => {
    if (!backendRecipe?.ingredientsConnection.pageInfo.hasNextPage) {
      return false;
    }
    toastService.error(
      t('recipes.ingredientsOverLimit', { count: MAX_RECIPE_INGREDIENTS }),
    );
    return true;
  };

  const lacked = useRecipeMissingIngredients(recipeId);
  const ingredientNodes = (
    backendRecipe?.ingredientsConnection.edges ?? []
  ).map(({ node }) => node);
  // What the pantry lacks may be on the list already, from an earlier visit.
  const { lines: openLines } = useOpenListLinesFor(
    targetListId,
    ingredientNodes.flatMap(node =>
      lacked?.has(node.id) && node.item ? [node.item.id] : [],
    ),
  );
  const listedItemIds = new Set(
    openLines.flatMap(line => (line.item ? [line.item.id] : [])),
  );
  const listedIngredients = new Set<string | number>(addedIngredients);
  for (const node of ingredientNodes) {
    if (node.item && listedItemIds.has(node.item.id)) {
      listedIngredients.add(node.id);
    }
  }
  const missing = lacked
    ? new Set([...lacked].filter(id => !listedIngredients.has(id)))
    : null;

  // Adds the action's ingredients to the picked list. Called after the list
  // picker resolves. `listName` may be passed for newly-created lists not yet
  // in the local array.
  const addIngredientsToList = (
    action: PendingAction,
    listId: string,
    listName?: string,
  ) => {
    const resolvedName = listName ?? getShoppingListById(listId)?.name;
    if (!resolvedName) {
      toastService.error(t('recipes.shoppingListNotFound'));
      return;
    }
    // Asked again: a refresh while the picker is open can find the recipe grown
    // past the limit.
    if (refusesRecipeOverLimit()) return;
    void executeWithLoadingState(
      async () => {
        const ingredients = (
          backendRecipe?.ingredientsConnection.edges ?? []
        ).flatMap(({ node }) =>
          action.type === 'all' || missing?.has(node.id) ? [node] : [],
        );
        const rows = recipeId
          ? recipeShoppingRows(recipeId, ingredients, {
              unnamed: t('recipes.unnamedIngredient'),
            })
          : [];
        if (rows.length === 0) {
          toastService.error(t('recipes.noIngredientsToAdd'));
          return;
        }
        const fallback = t('recipes.addIngredientsToListFailed');
        const { added, updated, refused, failed } = await addRows(
          listId,
          rows,
          fallback,
        );
        // A refused row stays unmarked, so it can be added on its own; the rows
        // of the slices that landed are marked even when another slice failed.
        setAddedIngredients(prev => {
          const next = new Set(prev);
          for (const row of rows) {
            if (!refused.has(row.input.id)) next.add(row.recipeIngredientId);
          }
          return next;
        });
        if (failed) return;
        if (added + updated === 0) {
          toastService.error(fallback);
          return;
        }
        toastService.success(
          updated > 0
            ? t('recipes.addedItemsToListUpdated', {
                count: added,
                listName: resolvedName,
                updated,
              })
            : t('recipes.addedItemsToList', {
                count: added,
                listName: resolvedName,
              }),
        );
      },
      setAddingToList,
      err => {
        logger.error('Failed to add ingredients:', err);
        toastService.error(t('recipes.addIngredientsToListFailed'));
      },
    );
  };

  // Entry point from the recipe ingredient list "Add All" button. Refused
  // before the picker opens, so no list is picked or created for nothing.
  const handleAddAll = () => {
    if (refusesRecipeOverLimit()) return;
    openListPicker({ type: 'all' });
  };

  // Only what the pantry lacks, so a held ingredient is not bought twice.
  const handleAddMissing = () => {
    if (refusesRecipeOverLimit()) return;
    openListPicker({ type: 'missing' });
  };

  const handleListSelected = (listId: string) => {
    setListPickerVisible(false);
    if (pendingAction) addIngredientsToList(pendingAction, listId);
    setPendingAction(null);
  };

  // Create a new shopping list and route the pending action into it.
  const handleCreateListAndAddIngredients = (name: string) => {
    if (!name.trim()) {
      toastService.error(t('errors.listNameEmpty'));
      return;
    }

    const currentPendingAction = pendingAction;

    void executeWithLoadingState(
      async () => {
        const created = await createShoppingList({
          name: name.trim(),
          description: t('recipes.createdFromRecipe'),
          isDefault: false,
          tags: ['recipe-created'],
        });
        if (created.status === 'failed') {
          toastService.error(created.body);
          return;
        }
        const newList = created.shoppingList;

        setSelectedShoppingListId(newList.id);
        setListPickerVisible(false);

        if (currentPendingAction) {
          addIngredientsToList(currentPendingAction, newList.id, newList.name);
        }
        setPendingAction(null);
      },
      setCreatingList,
      err => {
        logger.error('Failed to create list and add ingredients:', err);
        toastService.error(t('errors.createShoppingListFailed'));
      },
    );
  };

  // List picker dismissed (selection, swipe, or blur) — sync visibility state.
  const handleSheetDismiss = () => {
    setListPickerVisible(false);
  };

  return {
    shoppingLists,
    shoppingListsState,
    retryShoppingLists: () => {
      void refetchShoppingLists();
    },
    addingToList,
    /** On the list: added from this page, or already on the active list. */
    listedIngredients,
    creatingList,

    handleAddSingleIngredient,
    handleAddAll,
    /** What the pantry lacks and no list holds yet; null until the server says. */
    missingIngredients: missing,
    handleAddMissing,
    handleListSelected,
    handleCreateListAndAddIngredients,
    handleSheetDismiss,

    listPickerVisible,
  };
}
