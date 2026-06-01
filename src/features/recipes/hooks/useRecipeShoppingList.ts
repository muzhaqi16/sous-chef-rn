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
  AddItemToShoppingListFromRecipeDocument,
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
        if (!data?.createShoppingListItemsFromRecipe || !variables) return;
        executeCacheUpdate(() => {
          const result = data.createShoppingListItemsFromRecipe;
          const shoppingListId = variables.input.shoppingListId;
          result.addedItems.forEach(item => {
            addNewItemToShoppingListCache(cache, shoppingListId, item);
          });
        }, 'Cache update failed for addRecipeToShoppingList:');
      },
      onError: err => {
        console.error('Add recipe to shopping list error:', err);
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

  const [addItemToShoppingListMutation] = useMutation(
    AddItemToShoppingListFromRecipeDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.addItemToShoppingList;
        if (
          payload?.__typename !== 'AddItemToShoppingListPayload' ||
          !variables
        ) {
          return;
        }
        executeCacheUpdate(() => {
          const item = payload.shoppingListItem;
          const shoppingListId = variables.input.shoppingListId;
          addNewItemToShoppingListCache(cache, shoppingListId, item);
        }, 'Cache update failed for addItemToShoppingList:');
      },
    },
  );

  const [addItemsToShoppingListMutation] = useMutation(
    AddItemsToShoppingListDocument,
    {
      update: (cache, { data }, { variables }) => {
        if (!data?.addItemsToShoppingList || !variables) return;
        executeCacheUpdate(() => {
          const { results } = data.addItemsToShoppingList!;
          const shoppingListId = variables.input.shoppingListId;
          results.forEach(result => {
            if (result.success && result.item) {
              addNewItemToShoppingListCache(cache, shoppingListId, result.item);
            }
          });
        }, 'Cache update failed for addItemsToShoppingList:');
      },
      onError: err => {
        console.error('Batch add items to shopping list error:', err);
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
          await addRecipeIngredientMutation({
            variables: {
              input: {
                recipeIngredientId: String(ingredient.id),
                shoppingListId: targetList.id,
              },
            },
          });
        } else if ('amount' in ingredient) {
          await addItemToShoppingListMutation({
            variables: {
              input: {
                itemName:
                  ingredient.name ||
                  ingredient.original ||
                  'Unknown ingredient',
                quantity: ingredient.amount || 0,
                unit: {
                  unitName:
                    ingredient.measures?.us?.unitShort ||
                    ingredient.measures?.metric?.unitShort ||
                    undefined,
                },
                shoppingListId: targetList.id,
                storePrefs: ingredient.aisle
                  ? { aisle: ingredient.aisle }
                  : undefined,
              },
            },
          });
        }

        setAddedIngredients(prev => new Set(prev).add(ingredient.id));
        toastService.success(
          t('recipes.addedToList', { listName: targetList.name }),
        );
      },
      err => {
        console.error('Failed to add ingredient:', err);
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

          const data = result.data?.createShoppingListItemsFromRecipe;
          if (data) {
            const allIngredientIds = backendRecipe.ingredients.map(
              ing => ing.id,
            );
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
              clientId: String(ingredient.id || index),
              itemName:
                ingredient.name || ingredient.original || 'Unknown ingredient',
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
          });

          const data = result.data?.addItemsToShoppingList;
          if (data) {
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
          }
        } else {
          toastService.error(t('recipes.noIngredientsToAdd'));
        }
      },
      setAddingToList,
      err => {
        console.error('Failed to add ingredients:', err);
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
                recipeIngredientId: ingredientId,
                shoppingListId: listId,
              },
            },
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
        console.error('Failed to add selected ingredients:', err);
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
        console.error('Failed to create list and add ingredients:', err);
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
