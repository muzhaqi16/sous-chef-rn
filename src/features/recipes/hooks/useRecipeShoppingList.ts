import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@apollo/client/react';
import type { BottomSheetModalRef } from '#hooks/useStandardBottomSheet';
import {
  CreateShoppingListItemsFromRecipeDocument,
  CreateShoppingListItemFromRecipeIngredientDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  type MaterializedRecipe,
  type DisplayIngredient,
} from './useRecipeData';
import {
  AddItemsToShoppingListDocument,
  GetShoppingListsLiteDocument,
  CreateShoppingListDocument,
} from './useRecipeDetail.generated';
import { type BatchAddShoppingListItemInput } from '#/graphql/generated/schemaTypes';
import { useAppStore, useSelectedShoppingListId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
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

type PendingAction =
  | { type: 'single'; ingredient?: DisplayIngredient }
  | { type: 'all' }
  | { type: 'selected' };

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
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    new Set(),
  );
  const [addingToList, setAddingToList] = useState(false);
  const [addedIngredients, setAddedIngredients] = useState<
    Set<string | number>
  >(new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [creatingList, setCreatingList] = useState(false);

  // Sheet refs and visibility state. Per CLAUDE.md, control visibility via
  // state + effect (never call present()/dismiss() directly from event handlers).
  const shoppingListOptionsRef = useRef<BottomSheetModalRef>(null);
  const ingredientSelectorRef = useRef<BottomSheetModalRef>(null);
  const listPickerRef = useRef<BottomSheetModalRef>(null);
  const pendingDismissActionRef = useRef<(() => void) | null>(null);

  const [listPickerVisible, setListPickerVisible] = useState(false);
  const [ingredientSelectorVisible, setIngredientSelectorVisible] =
    useState(false);

  useEffect(() => {
    if (listPickerVisible) {
      listPickerRef.current?.present();
    } else {
      listPickerRef.current?.dismiss();
    }
  }, [listPickerVisible]);

  useEffect(() => {
    if (ingredientSelectorVisible) {
      ingredientSelectorRef.current?.present();
    } else {
      ingredientSelectorRef.current?.dismiss();
    }
  }, [ingredientSelectorVisible]);

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

  const [addRecipeToShoppingListMutation] = useMutation(
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
          const result = payload.result;
          const shoppingListId = variables.input.shoppingListId;
          result.addedItems.forEach(item => {
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
          const ingredientResult = response.result;
          const shoppingListId = variables.input.shoppingListId;
          if (!ingredientResult.wasUpdated) {
            addNewItemToShoppingListCache(
              cache,
              shoppingListId,
              ingredientResult.shoppingListItem,
            );
          }
        }, 'Cache update failed for addRecipeIngredient:');
      },
    },
  );

  const [addItemsToShoppingListMutation] = useMutation(
    AddItemsToShoppingListDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.addItemsToShoppingList;
        if (
          payload?.__typename !== 'AddItemsToShoppingListPayload' ||
          !variables
        )
          return;
        executeCacheUpdate(() => {
          const { results } = payload.result;
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
          await addRecipeIngredientMutation({
            variables: {
              input: {
                id: generateEntityId(),
                recipeIngredientId: String(ingredient.id),
                shoppingListId: targetList.id,
              },
            },
            context: { localFirst: true },
          });
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
                    itemName: stripPriceFromName(
                      ingredient.name ||
                        ingredient.original ||
                        'Unknown ingredient',
                    ),
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

          // Mirror addAllIngredientsToList: a transport error is surfaced by the
          // mutation onError, so skip the success toast for it. A success
          // payload or an offline-queued result (no data, no error) confirm.
          const payload = result.data?.addItemsToShoppingList;
          if (
            payload?.__typename !== 'AddItemsToShoppingListPayload' &&
            result.error
          ) {
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
          const result = await addRecipeToShoppingListMutation({
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
            const data = payload.result;
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
              itemName: stripPriceFromName(
                ingredient.name || ingredient.original || 'Unknown ingredient',
              ),
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
            const data = payload.result;
            const successfullyAddedIds = data.results
              .filter(r => r.success)
              .map(r => Number(r.clientId));
            setAddedIngredients(prev => {
              const next = new Set(prev);
              successfullyAddedIds.forEach(id => next.add(id));
              return next;
            });
            toastService.success(
              data.incrementedCount > 0
                ? t('recipes.addedItemsToListUpdated', {
                    count: data.successCount,
                    listName: resolvedName,
                    updated: data.incrementedCount,
                  })
                : t('recipes.addedItemsToList', {
                    count: data.successCount,
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

  // Adds the user-selected subset of ingredients to the picked list.
  const addSelectedIngredientsToList = (listId: string, listName?: string) => {
    if (!backendRecipe || !recipeId) return;

    const resolvedName = listName ?? getShoppingListById(listId)?.name;
    if (!resolvedName) {
      toastService.error(t('recipes.shoppingListNotFound'));
      return;
    }

    executeWithLoadingState(
      async () => {
        let addedCount = 0;
        let updatedCount = 0;

        for (const ingredientId of selectedIngredients) {
          const result = await addRecipeIngredientMutation({
            variables: {
              input: {
                id: generateEntityId(),
                recipeIngredientId: ingredientId,
                shoppingListId: listId,
              },
            },
            context: { localFirst: true },
          });

          const response =
            result.data?.createShoppingListItemFromRecipeIngredient;
          if (
            response?.__typename ===
            'CreateShoppingListItemFromRecipeIngredientPayload'
          ) {
            if (response.result.wasUpdated) {
              updatedCount++;
            } else {
              addedCount++;
            }
          }
        }

        toastService.success(
          updatedCount > 0
            ? t('recipes.addedItemsToListUpdated', {
                count: addedCount,
                listName: resolvedName,
                updated: updatedCount,
              })
            : t('recipes.addedItemsToList', {
                count: addedCount,
                listName: resolvedName,
              }),
        );
        setSelectedIngredients(new Set());
      },
      setAddingToList,
      err => {
        logger.error('Failed to add selected ingredients:', err);
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
    } else if (pendingAction?.type === 'selected') {
      addSelectedIngredientsToList(listId);
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
        } else if (currentPendingAction?.type === 'selected') {
          addSelectedIngredientsToList(newList.id, newList.name);
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

  // Entry point from the shopping-list-options sheet "Add All" row.
  // Dismisses the options sheet first; the dismiss callback then opens the picker.
  const handleAddAllFromSheet = () => {
    if (!backendRecipe || !recipeId) {
      toastService.error(t('recipes.cannotAddExternalIngredients'));
      return;
    }
    pendingDismissActionRef.current = () => openListPicker({ type: 'all' });
    shoppingListOptionsRef.current?.dismiss();
  };

  const openIngredientSelector = () => {
    pendingDismissActionRef.current = () => setIngredientSelectorVisible(true);
    shoppingListOptionsRef.current?.dismiss();
  };

  const toggleIngredient = (ingredientId: string) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  };

  const handleAddSelectedIngredients = () => {
    if (!backendRecipe || !recipeId) return;
    if (selectedIngredients.size === 0) {
      toastService.error(t('recipes.selectAtLeastOneIngredient'));
      return;
    }

    pendingDismissActionRef.current = () =>
      openListPicker({ type: 'selected' });
    setIngredientSelectorVisible(false);
  };

  // Runs after each sheet's dismiss animation; flushes the queued cross-sheet action.
  const handleSheetDismiss = () => {
    const action = pendingDismissActionRef.current;
    pendingDismissActionRef.current = null;
    action?.();
  };

  return {
    shoppingLists,
    selectedIngredients,
    addingToList,
    addedIngredients,
    creatingList,

    handleAddSingleIngredient,
    handleAddAll,
    handleAddAllFromSheet,
    handleAddSelectedIngredients,
    handleListSelected,
    handleCreateListAndAddIngredients,
    openIngredientSelector,
    toggleIngredient,
    handleSheetDismiss,

    shoppingListOptionsRef,
    ingredientSelectorRef,
    listPickerRef,
  };
}
