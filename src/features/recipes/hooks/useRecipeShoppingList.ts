import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  CreateShoppingListItemsFromRecipeDocument,
  CreateShoppingListItemFromRecipeIngredientDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  type MaterializedRecipe,
  type DisplayIngredient,
} from './useRecipeData';
import {
  AddItemsToShoppingListFromRecipeDocument,
  GetShoppingListsLiteDocument,
  CreateShoppingListDocument,
} from './useRecipeDetail.generated';
import { type BatchAddShoppingListItemInput } from '#/graphql/generated/schemaTypes';
import { useAppStore, useSelectedShoppingListId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { toastService } from '#/services/toastService';
import type { RecipeInformation } from '#/services/recipeApi/types';
import {
  executeCacheUpdate,
  executeMutation,
  executeWithLoadingState,
} from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import { logger } from '#/utils/environment';
import { stripPriceFromName } from '#/utils/stripPriceFromName';

interface UseRecipeShoppingListOptions {
  recipeId: string | undefined;
  isBackendRecipe: boolean;
  backendRecipe: MaterializedRecipe | null | undefined;
  externalRecipe: RecipeInformation | null;
}

type PendingAction = { type: 'all' };

export function useRecipeShoppingList({
  recipeId,
  isBackendRecipe,
  backendRecipe,
  externalRecipe,
}: UseRecipeShoppingListOptions) {
  const { t } = useTranslation();
  const { data: shoppingListsData, loading: shoppingListsLoading } = useQuery(
    GetShoppingListsLiteDocument,
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
    shoppingLists.find(list => list.id === listId) || null;

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
  const addToShoppingListsCache = createAddToQueryConnectionUpdater(
    'shoppingLists',
    'ShoppingList',
  );
  const [createShoppingListMutation] = useMutation(CreateShoppingListDocument, {
    update(cache, { data }) {
      const payload = data?.createShoppingList;
      if (payload?.__typename === 'CreateShoppingListPayload') {
        addToShoppingListsCache(cache, payload.shoppingList);
      }
    },
    onError: () => {
      toastService.error(t('recipes.createListFailed'));
    },
  });

  const [createShoppingListItemsFromRecipeMutation] = useMutation(
    CreateShoppingListItemsFromRecipeDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.createShoppingListItemsFromRecipe;
        if (
          payload?.__typename !== 'CreateShoppingListItemsFromRecipePayload' ||
          !variables
        )
          return;
        executeCacheUpdate(() => {
          const shoppingListId = variables.input.shoppingListId;
          payload.addedItems.forEach(item => {
            addNewItemToShoppingListCache(cache, shoppingListId, item);
          });
        }, 'Cache update failed for addRecipeToShoppingList:');
      },
      onError: err => {
        logger.error('Add recipe to shopping list error:', err);
        const errorMessage =
          err.message || t('recipes.addIngredientsToListFailed');
        toastService.error(
          t('recipes.couldNotAddIngredients', { error: errorMessage }),
        );
      },
    },
  );

  const [addRecipeIngredientMutation] = useMutation(
    CreateShoppingListItemFromRecipeIngredientDocument,
    {
      update: (cache, { data }, { variables }) => {
        const response = data?.createShoppingListItemFromRecipeIngredient;
        if (
          response?.__typename !==
            'CreateShoppingListItemFromRecipeIngredientPayload' ||
          !variables
        )
          return;
        executeCacheUpdate(() => {
          const shoppingListId = variables.input.shoppingListId;
          if (!response.wasUpdated) {
            addNewItemToShoppingListCache(
              cache,
              shoppingListId,
              response.shoppingListItem,
            );
          }
        }, 'Cache update failed for addRecipeIngredient:');
      },
    },
  );

  const [addItemsToShoppingListMutation] = useMutation(
    AddItemsToShoppingListFromRecipeDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.addItemsToShoppingList;
        if (
          payload?.__typename !== 'AddItemsToShoppingListPayload' ||
          !variables
        )
          return;
        executeCacheUpdate(() => {
          const { results } = payload;
          const shoppingListId = variables.input.shoppingListId;
          results.forEach(result => {
            if (result.success && result.item) {
              addNewItemToShoppingListCache(cache, shoppingListId, result.item);
            }
          });
        }, 'Cache update failed for addItemsToShoppingList:');
      },
      onError: err => {
        logger.error('Batch add items to shopping list error:', err);
        const errorMessage =
          err.message || t('recipes.addIngredientsToListFailed');
        toastService.error(
          t('recipes.couldNotAddIngredients', { error: errorMessage }),
        );
      },
    },
  );

  // Add a single ingredient to the user's default/selected list (no picker).
  const handleAddSingleIngredient = (ingredient: DisplayIngredient) => {
    const targetList = getTargetShoppingList();
    if (!targetList) {
      toastService.error(t('recipes.createListFirst'));
      return;
    }

    executeMutation(
      async () => {
        if (isBackendRecipe) {
          // Generate the new item's id so a create that gets queued (offline /
          // API down) replays idempotently, keyed by this id.
          const result = await addRecipeIngredientMutation({
            variables: {
              input: {
                id: generateEntityId(),
                recipeIngredientId: String(ingredient.id),
                shoppingListId: targetList.id,
              },
            },
            context: { localFirst: true },
          });

          // This mutation has no onError, so a resolved error-union payload or a
          // transport error would otherwise fall through to the success toast.
          // Classify and report once on rejection; 'created'/'queued' confirm.
          if (classifyCreateResult(result) === 'rejected') {
            toastService.error(t('recipes.addIngredientToListFailed'));
            return;
          }
        } else if ('amount' in ingredient) {
          // Single ingredient goes through the same batch mutation as a
          // one-element `items` array — there is no separate single-add op.
          const result = await addItemsToShoppingListMutation({
            variables: {
              input: {
                shoppingListId: targetList.id,
                items: [
                  {
                    id: generateEntityId(),
                    item: {
                      itemName: stripPriceFromName(
                        ingredient.name ||
                          ingredient.original ||
                          'Unknown ingredient',
                      ),
                    },
                    quantity: ingredient.amount || 0,
                    unit: {
                      unitName:
                        ingredient.measures?.us?.unitShort ||
                        ingredient.measures?.metric?.unitShort ||
                        undefined,
                    },
                    storePrefs: ingredient.aisle
                      ? { aisle: ingredient.aisle }
                      : undefined,
                  },
                ],
              },
            },
            context: { localFirst: true },
          });

          // A resolved error-union payload or a transport error must not fall
          // through to the success toast. Classify: 'created'/'queued' confirm;
          // 'rejected' reports and returns. The mutation's onError already
          // toasts on a transport error, so toast here only for the resolved
          // error-union case — exactly one toast either way.
          if (classifyCreateResult(result) === 'rejected') {
            if (!result.error) {
              toastService.error(t('recipes.addIngredientToListFailed'));
            }
            return;
          }
        }

        setAddedIngredients(prev => new Set(prev).add(ingredient.id));
        toastService.success(
          t('recipes.addedToList', { listName: targetList.name }),
        );
      },
      err => {
        logger.error('Failed to add ingredient:', err);
        toastService.error(t('recipes.addIngredientToListFailed'));
      },
    );
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

    executeWithLoadingState(
      async () => {
        if (isBackendRecipe && backendRecipe && recipeId) {
          const result = await createShoppingListItemsFromRecipeMutation({
            variables: {
              input: {
                recipeId,
                shoppingListId: listId,
                servings: backendRecipe.servings,
              },
            },
          });

          const payload = result.data?.createShoppingListItemsFromRecipe;
          if (
            payload?.__typename === 'CreateShoppingListItemsFromRecipePayload'
          ) {
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
        } else if (externalRecipe?.extendedIngredients) {
          const items: BatchAddShoppingListItemInput[] =
            externalRecipe.extendedIngredients.map((ingredient, index) => ({
              // `id` is the row's primary key (so a queued batch replays
              // idempotently); `clientId` stays the ingredient index used below
              // to match each result back to its ingredient.
              id: generateEntityId(),
              clientId: String(ingredient.id || index),
              item: {
                itemName: stripPriceFromName(
                  ingredient.name ||
                    ingredient.original ||
                    'Unknown ingredient',
                ),
              },
              quantity: ingredient.amount || 0,
              unit: {
                unitName:
                  ingredient.measures?.us?.unitShort ||
                  ingredient.measures?.metric?.unitShort ||
                  '',
              },
              storePrefs: ingredient.aisle
                ? { aisle: ingredient.aisle }
                : undefined,
            }));

          const result = await addItemsToShoppingListMutation({
            variables: {
              input: {
                shoppingListId: listId,
                items,
              },
            },
            context: { localFirst: true },
          });

          const payload = result.data?.addItemsToShoppingList;
          if (payload?.__typename === 'AddItemsToShoppingListPayload') {
            const data = payload;
            const successfullyAddedIds = data.results
              .filter(r => r.success)
              .map(r => Number(r.clientId));
            setAddedIngredients(prev => {
              const next = new Set(prev);
              successfullyAddedIds.forEach(id => next.add(id));
              return next;
            });
            toastService.success(
              data.summary.skipped > 0
                ? t('recipes.addedItemsToListUpdated', {
                    count: data.summary.succeeded,
                    listName: resolvedName,
                    updated: data.summary.skipped,
                  })
                : t('recipes.addedItemsToList', {
                    count: data.summary.succeeded,
                    listName: resolvedName,
                  }),
            );
          } else if (!result.error) {
            // No data and no error → the batch was queued while offline / the API
            // was unreachable. The items replay later; mark them all added and
            // confirm so the recipe reflects the request.
            setAddedIngredients(prev => {
              const next = new Set(prev);
              externalRecipe.extendedIngredients.forEach(ing =>
                next.add(ing.id),
              );
              return next;
            });
            toastService.success(
              t('recipes.addedItemsToList', {
                count: items.length,
                listName: resolvedName,
              }),
            );
          }
        } else {
          toastService.error(t('recipes.noIngredientsToAdd'));
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
      toastService.error(t('recipes.listNameEmpty'));
      return;
    }

    const currentPendingAction = pendingAction;

    executeWithLoadingState(
      async () => {
        const result = await createShoppingListMutation({
          variables: {
            input: {
              name: name.trim(),
              description: 'Created from recipe',
              isDefault: false,
              tags: ['recipe-created'],
            },
          },
        });

        const createPayload = result.data?.createShoppingList;
        if (createPayload?.__typename !== 'CreateShoppingListPayload') {
          toastService.error(t('recipes.createShoppingListFailed'));
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
        toastService.error(t('recipes.createShoppingListFailed'));
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
