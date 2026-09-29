import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  CreateShoppingListItemsFromRecipeDocument,
  CreateShoppingListItemFromRecipeIngredientDocument,
} from '#features/recipes/graphql/recipe.generated';
import type { MaterializedRecipe, DisplayIngredient } from './useRecipeData';
import {
  GetShoppingListsLiteForRecipeDocument,
  CreateShoppingListForRecipeDocument,
} from './useRecipeDetail.generated';
import { useAppStore, useSelectedShoppingListId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { addNewItemToShoppingListCache } from '#features/shoppingList/cache/connections';
import { addShoppingListToQueryCache } from '#features/shoppingList/cache/list';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { toastService } from '#/services/toastService';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingItemCreateUpdate,
  revertOptimisticShoppingListItem,
} from '#features/shoppingList/cache/items';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';
import type { CreateShoppingListItemFromRecipeIngredientInput } from '#/graphql/generated/schemaTypes';

interface UseRecipeShoppingListOptions {
  recipeId: string | undefined;
  backendRecipe: MaterializedRecipe | null | undefined;
}

type PendingAction = { type: 'all' };

/**
 * Adds one recipe ingredient and resolves to the failure when the item did not
 * land. Module-level, not inline: a value block inside the caller's try/catch
 * bails the whole hook out of the React Compiler.
 */
async function addIngredientToList(
  ingredient: DisplayIngredient,
  shoppingListId: string,
  deps: {
    // Typed with the generated input shape so the mutate function from
    // `useMutation()` is assignable as-is.
    addRecipeIngredientMutation(options: {
      variables: { input: CreateShoppingListItemFromRecipeIngredientInput };
      context: { localFirst: boolean };
    }): Promise<{ data?: unknown; error?: unknown }>;
    /** The caller's copy for a refused add. */
    fallback: string;
    /** The name a line takes when the ingredient carries none. */
    unnamedIngredient: string;
    /** Write the row into the cache before firing, so it survives being queued. */
    writeOptimisticRow(
      rowId: string,
      fields: {
        itemName: string;
        quantity: number | null;
        unitName: string | null;
        itemId?: string;
      },
    ): void;
    /** Take the row back when the server refuses it. */
    revertOptimisticRow(rowId: string): void;
  },
): Promise<SettledFailure | undefined> {
  // Minted here so a create that gets queued replays idempotently.
  const rowId = generateEntityId();
  // Shown before the server answers: `update:` never runs offline.
  deps.writeOptimisticRow(rowId, {
    itemName: ingredient.name || deps.unnamedIngredient,
    quantity: ingredient.quantity,
    unitName:
      firstNonBlank(ingredient.unit?.symbol, ingredient.unit?.name) ?? null,
    itemId: ingredient.item?.id,
  });

  const settled = await settleMutation(
    () =>
      deps.addRecipeIngredientMutation({
        variables: {
          input: {
            id: rowId,
            recipeIngredientId: ingredient.id,
            shoppingListId,
          },
        },
        context: { localFirst: true },
      }),
    {
      document: CreateShoppingListItemFromRecipeIngredientDocument,
      fallback: deps.fallback,
      onFailed: () => deps.revertOptimisticRow(rowId),
      present: 'none',
    },
  );
  return settled.failure;
}

export function useRecipeShoppingList({
  recipeId,
  backendRecipe,
}: UseRecipeShoppingListOptions) {
  const { t } = useTranslation();
  const { data: shoppingListsData, loading: shoppingListsLoading } = useQuery(
    GetShoppingListsLiteForRecipeDocument,
    {},
  );
  const shoppingLists = extractNodes(shoppingListsData?.shoppingLists);

  const selectedShoppingListId = useSelectedShoppingListId();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  // Priority: user's selected list > default list > first list.
  const getTargetShoppingList = () => {
    if (shoppingLists.length === 0) return null;
    if (selectedShoppingListId) {
      const selected = shoppingLists.find(l => l.id === selectedShoppingListId);
      if (selected) return selected;
    }
    const defaultList = shoppingLists.find(list => list.isDefault);
    return defaultList ?? shoppingLists[0];
  };

  const getShoppingListById = (listId: string) =>
    shoppingLists.find(list => list.id === listId) ?? null;

  const client = useApolloClient();

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

  // Mutations
  const [createShoppingListMutation] = useMutation(
    CreateShoppingListForRecipeDocument,
    {
      update(cache, { data }) {
        const payload = appliedPayload(data);
        if (payload) addShoppingListToQueryCache(cache, payload.shoppingList);
      },
    },
  );

  const [createShoppingListItemsFromRecipeMutation] = useMutation(
    CreateShoppingListItemsFromRecipeDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = appliedPayload(data);
        if (!payload || !variables) return;
        try {
          const shoppingListId = variables.input.shoppingListId;
          payload.addedItems.forEach(item => {
            addNewItemToShoppingListCache(cache, shoppingListId, item);
          });
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for addRecipeToShoppingList:',
          });
        }
      },
    },
  );

  const [addRecipeIngredientMutation] = useMutation(
    CreateShoppingListItemFromRecipeIngredientDocument,
    {
      update: (cache, { data }, { variables }) => {
        const response = appliedPayload(data);
        if (!response || !variables) return;
        try {
          // The row was already written and counted optimistically, so this
          // only re-wires the edge — and withdraws the optimistic row when the
          // server merged the ingredient into an existing line.
          reconcileShoppingItemCreateUpdate(
            cache,
            variables.input.shoppingListId,
            response.shoppingListItem,
            variables.input.id,
          );
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for addRecipeIngredient:',
          });
        }
      },
    },
  );

  // Add a single ingredient to the user's default/selected list (no picker).
  const handleAddSingleIngredient = async (ingredient: DisplayIngredient) => {
    const targetList = getTargetShoppingList();
    if (!targetList) {
      toastService.error(t('recipes.createListFirst'));
      return;
    }

    try {
      const listId = targetList.id;
      const failure = await addIngredientToList(ingredient, listId, {
        addRecipeIngredientMutation,
        fallback: t('recipes.addIngredientToListFailed'),
        unnamedIngredient: t('recipes.unnamedIngredient'),
        // Written before the mutation fires so the row shows immediately and
        // survives being queued — the `update:` callbacks only run with a
        // server payload, so offline they never fire.
        writeOptimisticRow: (rowId, fields) => {
          const row = createOptimisticShoppingListItem(rowId, {
            shoppingListId: listId,
            itemName: fields.itemName,
            quantity: fields.quantity,
            quantityInput: null,
            unitName: fields.unitName,
            category: null,
            itemId: fields.itemId,
            unitId: undefined,
          });
          try {
            addOptimisticShoppingListItem(client.cache, listId, row);
          } catch (cacheError) {
            errorService.reportError(cacheError, {
              operation: 'Add recipe ingredient (optimistic)',
            });
          }
        },
        revertOptimisticRow: rowId =>
          revertOptimisticShoppingListItem(client.cache, listId, rowId),
      });
      if (failure) {
        toastService.error(failure.body);
        return;
      }

      setAddedIngredients(prev => new Set(prev).add(ingredient.id));
      toastService.success(
        t('recipes.addedToList', { listName: targetList.name }),
      );
    } catch (err) {
      logger.error('Failed to add ingredient:', err);
      toastService.error(t('recipes.addIngredientToListFailed'));
    }
  };

  // Adds all ingredients to the picked list. Called after the list picker
  // resolves. `listName` may be passed for newly-created lists not yet in
  // the local array.
  const addAllIngredientsToList = (listId: string, listName?: string) => {
    const resolvedName = listName ?? getShoppingListById(listId)?.name;
    if (!resolvedName) {
      toastService.error(t('recipes.shoppingListNotFound'));
      return;
    }
    void executeWithLoadingState(
      async () => {
        if (!backendRecipe || !recipeId) {
          toastService.error(t('recipes.noIngredientsToAdd'));
          return;
        }
        const settled = await settleMutation(
          () =>
            createShoppingListItemsFromRecipeMutation({
              variables: {
                // No `servings`: it counts servings to shop for, and the
                // whole recipe is the default.
                input: { recipeId, shoppingListId: listId },
              },
            }),
          {
            document: CreateShoppingListItemsFromRecipeDocument,
            fallback: t('recipes.addIngredientsToListFailed'),
            present: 'none',
          },
        );
        if (settled.failure) {
          toastService.error(settled.failure.body);
          return;
        }

        const payload = appliedPayload(settled.data);
        if (payload) {
          const data = payload;
          const allIngredientIds = extractNodes(
            backendRecipe.ingredientsConnection,
          ).map(ing => ing.id);
          setAddedIngredients(prev => {
            const next = new Set(prev);
            allIngredientIds.forEach(id => next.add(id));
            return next;
          });
          toastService.success(
            data.totalUpdated > 0
              ? t('recipes.addedItemsToListUpdated', {
                  count: data.totalAdded,
                  listName: resolvedName,
                  updated: data.totalUpdated,
                })
              : t('recipes.addedItemsToList', {
                  count: data.totalAdded,
                  listName: resolvedName,
                }),
          );
        }
      },
      setAddingToList,
      err => {
        logger.error('Failed to add ingredients:', err);
        toastService.error(t('recipes.addIngredientsToListFailed'));
      },
    );
  };

  // Entry point from the recipe ingredient list "Add All" button.
  const handleAddAll = () => {
    openListPicker({ type: 'all' });
  };

  const handleListSelected = (listId: string) => {
    setListPickerVisible(false);
    if (pendingAction?.type === 'all') {
      addAllIngredientsToList(listId);
    }
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
        const fallback = t('errors.createShoppingListFailed');
        const settled = await settleMutation(
          () =>
            createShoppingListMutation({
              variables: {
                input: {
                  name: name.trim(),
                  description: t('recipes.createdFromRecipe'),
                  isDefault: false,
                  tags: ['recipe-created'],
                },
              },
            }),
          {
            document: CreateShoppingListForRecipeDocument,
            fallback,
            present: 'none',
          },
        );

        const createPayload = appliedPayload(settled.data);
        if (!createPayload) {
          toastService.error(settled.failure?.body ?? fallback);
          return;
        }
        const newList = createPayload.shoppingList;

        setSelectedShoppingListId(newList.id);
        setListPickerVisible(false);

        if (currentPendingAction?.type === 'all') {
          addAllIngredientsToList(newList.id, newList.name);
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
    addingToList,
    addedIngredients,
    creatingList,

    handleAddSingleIngredient,
    handleAddAll,
    handleListSelected,
    handleCreateListAndAddIngredients,
    handleSheetDismiss,

    listPickerVisible,
  };
}
