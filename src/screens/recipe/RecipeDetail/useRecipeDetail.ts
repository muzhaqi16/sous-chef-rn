import { useState, useEffect, useRef } from 'react';
import { useRoute } from '@react-navigation/native';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type { RecipeInformation } from '#/services/recipeApi/types';
import {
  useGetRecipeQuery,
  useCreateShoppingListItemsFromRecipeMutation,
  useCreateShoppingListItemFromRecipeIngredientMutation,
  useAddItemToShoppingListMutation,
  useAddItemsToShoppingListMutation,
  useGetShoppingListsLiteQuery,
  useMyRecipesQuery,
  useMarkRecipeAsCookedMutation,
  useUpdateFavoriteRecipeMutation,
  useUnfavoriteRecipeMutation,
  useCreateShoppingListMutation,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
  type BatchAddShoppingListItemInput,
} from '#generated';
import { useAppStore, useSelectedShoppingListId } from '#store/useAppStore';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { normalizeRecipes, extractNodes } from '#/utils/connectionUtils';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { toastService } from '#/services/toastService';
import { useRecipePreload } from '#/hooks/recipe/useRecipePreload';
import { useRecipeIngredientMatching } from '#/hooks/recipe/useRecipeIngredientMatching';
import {
  executeCacheUpdate,
  executeMutation,
  executeWithLoadingState,
} from '#/utils/compilerSafeWrappers';

type RecipeDetailParams = {
  recipeId?: string;
  externalSource?: string;
  externalId?: string;
  sourceTab?: 'Pantry' | 'ShoppingList' | 'Recipe';
  sourcePantryItemId?: string;
};

export interface RecipeDisplayData {
  title: string;
  image?: string;
  servings?: number;
  readyInMinutes?: number;
  healthScore?: number;
  summary?: string;
  ingredients: any[];
  instructions?: any;
  instructionsHtml?: string;
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
  sourceName?: string;
  sourceUrl?: string;
}

/** Module-level helper: syncs derived saved-recipe state into React state */
function syncSavedRecipeState(
  derivedSaved: boolean,
  derivedFolder: string | null,
  setRecipeSaved: (v: boolean) => void,
  setSavedFolderLocal: (v: string | null) => void,
): void {
  setRecipeSaved(derivedSaved);
  setSavedFolderLocal(derivedSaved ? derivedFolder : null);
}

/** Module-level helper: handles recipe loading with loading/error state management.
 *  Extracted from the hook body to avoid React Compiler bailout from try-catch-finally. */
async function fetchRecipeData(
  params: {
    recipeId: string | undefined;
    externalSource: string | undefined;
    externalId: string | undefined;
    backendLoading: boolean;
  },
  signal: AbortSignal,
  setExternalRecipe: (recipe: RecipeInformation) => void,
  setError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
  preloadRecipe: (recipe: RecipeInformation) => Promise<unknown>,
): Promise<void> {
  if (params.recipeId) {
    setLoading(params.backendLoading);
    return;
  }

  if (!params.externalSource || !params.externalId) {
    setError('Recipe not available.');
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    setError(null);

    if (params.externalSource === 'SPOONACULAR') {
      const data = await spoonacularService.getRecipeInformation(
        {
          id: Number(params.externalId),
          includeNutrition: true,
        },
        signal,
      );
      setExternalRecipe(data);

      // Preload recipe to backend (fire-and-forget)
      preloadRecipe(data).catch(() => {
        // Ignore errors - fire and forget
      });
    } else {
      throw new Error(`Unsupported external source: ${params.externalSource}`);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    console.error('Failed to fetch recipe:', err);
    setError('Failed to load recipe. Please try again.');
  } finally {
    setLoading(false);
  }
}

export function useRecipeDetail() {
  const route = useRoute();
  const params = route.params as RecipeDetailParams | undefined;
  const { goBack } = useAppNavigation();
  const recipeId = params?.recipeId;
  const externalSource = params?.externalSource;
  const externalId = params?.externalId;

  // Get shopping lists - uses lightweight query for list metadata only
  const { data: shoppingListsData, loading: shoppingListsLoading } =
    useGetShoppingListsLiteQuery({
      fetchPolicy: 'cache-and-network',
    });
  // Extract nodes from connection type (shoppingLists returns ShoppingListConnection)
  const shoppingLists = extractNodes(shoppingListsData?.shoppingLists);

  // Get user's selected shopping list ID from app store
  const selectedShoppingListId = useSelectedShoppingListId();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  // Helper to get the target list for single ingredient adds
  // Priority: user's selected list > default list > first list
  const getTargetShoppingList = () => {
    if (shoppingLists.length === 0) return null;

    // First try user's selected list
    if (selectedShoppingListId) {
      const selectedList = shoppingLists.find(
        list => list.id === selectedShoppingListId,
      );
      if (selectedList) return selectedList;
    }

    // Then try default list
    const defaultList = shoppingLists.find(list => list.isDefault);
    if (defaultList) return defaultList;

    // Fall back to first list
    return shoppingLists[0];
  };

  // Helper to get list by ID
  const getShoppingListById = (listId: string) => {
    return shoppingLists.find(list => list.id === listId) || null;
  };

  // Open list picker for "Add All" flow
  const openListPicker = (action: { type: 'all' | 'selected' }) => {
    if (shoppingListsLoading) {
      toastService.info('Loading shopping lists...');
      return;
    }
    setPendingAction(action);
    setListPickerVisible(true);
  };

  // State for external recipes
  const [loading, setLoading] = useState(true);
  const [externalRecipe, setExternalRecipe] =
    useState<RecipeInformation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);

  // State for shopping list
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    new Set(),
  );
  const [addingToList, setAddingToList] = useState(false);
  const [addedIngredients, setAddedIngredients] = useState<
    Set<string | number>
  >(new Set());

  // State for list picker (two-step add flow)
  const [pendingAction, setPendingAction] = useState<{
    type: 'single' | 'all' | 'selected';
    ingredient?: any;
  } | null>(null);

  // State for mark as cooked modal
  const [cookedModalVisible, setCookedModalVisible] = useState(false);
  const [markingAsCooked, setMarkingAsCooked] = useState(false);

  // Ingredient matching for granular deduction
  const ingredientMatching = useRecipeIngredientMatching(recipeId);

  // State for folder/tag editing
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [updatingFolderTags, setUpdatingFolderTags] = useState(false);

  // Local state to track saved folder for external recipes (since backendRecipe is null)
  const [savedFolderLocal, setSavedFolderLocal] = useState<string | null>(null);

  // Recipe preload hook - preloads recipe to backend and handles favorites
  const {
    preloading,
    preloadedRecipe,
    preloadRecipe,
    saveRecipeToFavorites,
    savingToFavorites,
  } = useRecipePreload({
    onFavoriteSuccess: () => {
      setRecipeSaved(true);
    },
  });

  // Refs for bottom sheets
  const shoppingListOptionsRef = useRef<BottomSheetModal>(null);
  const ingredientSelectorRef = useRef<BottomSheetModal>(null);
  const listPickerRef = useRef<BottomSheetModal>(null);

  // Per CLAUDE.md: control sheet visibility via state + effect, never call
  // present()/dismiss() directly from event handlers. The state below tracks
  // desired visibility for each sheet; the effects below dispatch the
  // imperative present/dismiss after render commits.
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

  // Pending action to execute after a sheet dismisses (avoids setTimeout between sheets)
  const pendingDismissActionRef = useRef<(() => void) | null>(null);

  // State for creating a new shopping list inline
  const [creatingList, setCreatingList] = useState(false);

  // Create shopping list mutation (for inline creation in list picker)
  const addToShoppingListsCache = createAddToQueryConnectionUpdater(
    'shoppingLists',
    'ShoppingList',
  );
  const [createShoppingListMutation] = useCreateShoppingListMutation({
    errorPolicy: 'all',
    update(cache, { data }) {
      const newList = data?.createShoppingList?.shoppingList;
      if (newList) {
        addToShoppingListsCache(cache, newList);
      }
    },
    onError: () => {
      toastService.error('Failed to create list');
    },
  });

  // Mutations
  const [addRecipeToShoppingListMutation] =
    useCreateShoppingListItemsFromRecipeMutation({
      update: (cache, { data }, { variables }) => {
        if (!data?.createShoppingListItemsFromRecipe || !variables) return;
        executeCacheUpdate(() => {
          const result = data.createShoppingListItemsFromRecipe;
          const shoppingListId = variables.input.shoppingListId;
          result.addedItems.forEach((item: any) => {
            addNewItemToShoppingListCache(cache, shoppingListId, item);
          });
        }, 'Cache update failed for addRecipeToShoppingList:');
      },
      onError: err => {
        console.error('Add recipe to shopping list error:', err);
        const errorMessage =
          err.message || 'Failed to add ingredients to shopping list';
        toastService.error(`Could not add ingredients: ${errorMessage}`);
      },
    });

  const [addRecipeIngredientMutation] =
    useCreateShoppingListItemFromRecipeIngredientMutation({
      update: (cache, { data }, { variables }) => {
        if (!data?.createShoppingListItemFromRecipeIngredient || !variables)
          return;
        executeCacheUpdate(() => {
          const result = data.createShoppingListItemFromRecipeIngredient;
          const shoppingListId = variables.shoppingListId;
          if (!result.wasUpdated) {
            addNewItemToShoppingListCache(
              cache,
              shoppingListId,
              result.shoppingListItem,
            );
          }
        }, 'Cache update failed for addRecipeIngredient:');
      },
    });

  const [addItemToShoppingListMutation] = useAddItemToShoppingListMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.addItemToShoppingList?.shoppingListItem || !variables) return;
      executeCacheUpdate(() => {
        const item = data.addItemToShoppingList!.shoppingListItem!;
        const shoppingListId = variables.input.shoppingListId;
        addNewItemToShoppingListCache(cache, shoppingListId, item);
      }, 'Cache update failed for addItemToShoppingList:');
    },
  });

  const [addItemsToShoppingListMutation] = useAddItemsToShoppingListMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.addItemsToShoppingList || !variables) return;
      executeCacheUpdate(() => {
        const { results } = data.addItemsToShoppingList!;
        const shoppingListId = variables.shoppingListId;
        // Add each successfully created item to the cache
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
        err.message || 'Failed to add ingredients to shopping list';
      toastService.error(`Could not add ingredients: ${errorMessage}`);
    },
  });

  const [markRecipeAsCookedMutation] = useMarkRecipeAsCookedMutation({
    onError: err => {
      console.error('Mark recipe as cooked error:', err);
      toastService.error(err.message || 'Failed to mark recipe as cooked');
    },
  });

  const [updateFavoriteRecipeMutation] = useUpdateFavoriteRecipeMutation({
    update: (cache, { data }) => {
      if (!data?.updateFavoriteRecipe?.savedRecipe) return;

      const updatedSavedRecipe = data.updateFavoriteRecipe.savedRecipe;

      // Update SavedRecipeFolders cache if a folder was set
      const folder = updatedSavedRecipe.folder;
      if (folder) {
        cache.updateQuery<SavedRecipeFoldersQuery>(
          { query: SavedRecipeFoldersDocument },
          existing => {
            if (!existing) return existing;
            if (existing.savedRecipeFolders.includes(folder)) {
              return existing;
            }
            return {
              ...existing,
              savedRecipeFolders: [...existing.savedRecipeFolders, folder],
            };
          },
        );
      }

      // Update the saved recipe in MySavedRecipes cache
      cache.updateQuery<MySavedRecipesQuery>(
        { query: MySavedRecipesDocument },
        existing => {
          if (!existing?.me) return existing;
          return {
            ...existing,
            me: {
              ...existing.me,
              savedRecipesConnection: {
                ...existing.me.savedRecipesConnection,
                edges: existing.me.savedRecipesConnection.edges.map(edge =>
                  edge.node.id === updatedSavedRecipe.id
                    ? { ...edge, node: { ...edge.node, ...updatedSavedRecipe } }
                    : edge,
                ),
              },
            },
          };
        },
      );
    },
    onError: err => {
      console.error('Update favorite recipe error:', err);
      toastService.error(err.message || 'Failed to update recipe');
    },
  });

  const [unfavoriteRecipeMutation] = useUnfavoriteRecipeMutation({
    // Use cache updates instead of refetchQueries for better performance and offline support
    update: (cache, { data }, { variables }) => {
      if (!data?.unfavoriteRecipe?.success || !variables?.recipeId) return;

      // 1. Remove from savedRecipesConnection
      cache.updateQuery<MySavedRecipesQuery>(
        { query: MySavedRecipesDocument },
        existing => {
          if (!existing?.me) return existing;
          return {
            ...existing,
            me: {
              ...existing.me,
              savedRecipesConnection: {
                ...existing.me.savedRecipesConnection,
                edges: existing.me.savedRecipesConnection.edges.filter(
                  edge => edge.node.recipe.id !== variables.recipeId,
                ),
                totalCount:
                  (existing.me.savedRecipesConnection.totalCount ?? 0) - 1,
              },
            },
          };
        },
      );

      // 2. Update recipe's savedDetails to null
      cache.modify({
        id: cache.identify({ __typename: 'Recipe', id: variables.recipeId }),
        fields: {
          savedDetails() {
            return null;
          },
        },
      });
    },
    onError: err => {
      console.error('Unfavorite recipe error:', err);
      toastService.error(err.message || 'Failed to remove recipe from saved');
    },
  });

  // Fetch backend recipe if recipeId is provided
  const {
    data: backendRecipeData,
    loading: backendLoading,
    error: backendError,
  } = useGetRecipeQuery({
    variables: { id: recipeId ?? '' },
    skip: !recipeId,
    fetchPolicy: 'network-only',
  });

  const backendRecipe = backendRecipeData?.recipe;

  // Fetch user's saved recipes to check if current recipe is already saved
  const { data: myRecipesData } = useMyRecipesQuery({
    fetchPolicy: 'cache-and-network',
    skip: !externalSource || !externalId,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetchRecipeData(
      { recipeId, externalSource, externalId, backendLoading },
      controller.signal,
      setExternalRecipe,
      setError,
      setLoading,
      preloadRecipe,
    );

    return () => controller.abort();
  }, [externalSource, externalId, recipeId, backendLoading, preloadRecipe]);

  // Check if current external recipe is already saved
  // Normalize recipes data inside the effect to avoid the unstable reference issue
  const normalizedRecipes = normalizeRecipes(myRecipesData?.recipes);
  const savedRecipesList = normalizedRecipes?.recipes || [];

  const savedRecipe =
    externalSource && externalId && savedRecipesList.length > 0
      ? savedRecipesList.find(
          (recipe: any) =>
            recipe.externalSource === externalSource &&
            recipe.externalId === externalId,
        )
      : undefined;

  const derivedRecipeSaved = !!savedRecipe;
  const derivedSavedFolderLocal = savedRecipe?.savedDetails?.folder ?? null;

  useEffect(() => {
    syncSavedRecipeState(
      derivedRecipeSaved,
      derivedSavedFolderLocal,
      setRecipeSaved,
      setSavedFolderLocal,
    );
  }, [derivedRecipeSaved, derivedSavedFolderLocal]);

  const isBackendRecipe = !!recipeId && !!backendRecipe;

  // For backend recipes, derive saved state from savedDetails
  // savedDetails is non-null when the recipe is in user's favorites
  const isSaved = isBackendRecipe ? !!backendRecipe?.savedDetails : recipeSaved;

  const handleSaveRecipe = (
    folder?: string | null,
    tags?: string[],
    notes?: string,
  ) => {
    if (!externalRecipe || !externalSource || !externalId) return;

    executeWithLoadingState(
      async () => {
        const result = await saveRecipeToFavorites(externalRecipe, {
          folder: folder ?? undefined,
          tags: tags && tags.length > 0 ? tags : undefined,
          notes: notes || undefined,
        });

        if (result.success) {
          setRecipeSaved(true);
          setSavedFolderLocal(folder ?? null);
        }
      },
      setSaving,
      err => console.error('Failed to save recipe:', err),
    );
  };

  // Add single ingredient to user's selected/default list (no picker)
  const handleAddSingleIngredient = (ingredient: any) => {
    const targetList = getTargetShoppingList();
    if (!targetList) {
      toastService.error('Please create a shopping list first.');
      return;
    }

    executeMutation(
      async () => {
        if (isBackendRecipe) {
          await addRecipeIngredientMutation({
            variables: {
              recipeIngredientId: ingredient.id,
              shoppingListId: targetList.id,
            },
          });
        } else {
          await addItemToShoppingListMutation({
            variables: {
              input: {
                itemName:
                  ingredient.name ||
                  ingredient.originalString ||
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
        toastService.success(`Added to "${targetList.name}"`);
      },
      err => {
        console.error('Failed to add ingredient:', err);
        toastService.error('Failed to add ingredient to shopping list.');
      },
    );
  };

  // Execute adding all ingredients to a specific list (called after list selection)
  // listName can be passed directly for newly created lists not yet in the local array
  const executeAddAllIngredientsToList = (
    listId: string,
    listName?: string,
  ) => {
    const resolvedName = listName ?? getShoppingListById(listId)?.name;
    if (!resolvedName) {
      toastService.error('Shopping list not found.');
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
              `Added ${data.totalAdded} items to "${resolvedName}"${
                data.totalUpdated > 0 ? `, updated ${data.totalUpdated}` : ''
              }`,
            );
          }
        } else if (externalRecipe?.extendedIngredients) {
          // Use batch mutation for external recipes
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
              shoppingListId: listId,
              items,
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

            const totalAdded = data.successCount;
            const totalIncremented = data.incrementedCount;
            toastService.success(
              `Added ${totalAdded} items to "${resolvedName}"${
                totalIncremented > 0 ? `, updated ${totalIncremented}` : ''
              }`,
            );
          }
        } else {
          toastService.error('No ingredients available to add.');
        }
      },
      setAddingToList,
      err => {
        console.error('Failed to add ingredients:', err);
        toastService.error('Failed to add ingredients to shopping list.');
      },
    );
  };

  // Execute adding selected ingredients to a specific list (called after list selection)
  // listName can be passed directly for newly created lists not yet in the local array
  const executeAddSelectedIngredientsToList = (
    listId: string,
    listName?: string,
  ) => {
    if (!backendRecipe || !recipeId) return;

    const resolvedName = listName ?? getShoppingListById(listId)?.name;
    if (!resolvedName) {
      toastService.error('Shopping list not found.');
      return;
    }

    executeWithLoadingState(
      async () => {
        let addedCount = 0;
        let updatedCount = 0;

        for (const ingredientId of selectedIngredients) {
          const result = await addRecipeIngredientMutation({
            variables: {
              recipeIngredientId: ingredientId,
              shoppingListId: listId,
            },
          });

          if (result.data?.createShoppingListItemFromRecipeIngredient) {
            const wasUpdated =
              result.data.createShoppingListItemFromRecipeIngredient.wasUpdated;
            if (wasUpdated) {
              updatedCount++;
            } else {
              addedCount++;
            }
          }
        }

        toastService.success(
          `Added ${addedCount} items to "${resolvedName}"${
            updatedCount > 0 ? `, updated ${updatedCount}` : ''
          }`,
        );
        setSelectedIngredients(new Set());
      },
      setAddingToList,
      err => {
        console.error('Failed to add selected ingredients:', err);
        toastService.error('Failed to add ingredients to shopping list.');
      },
    );
  };

  // Open list picker for "Add All" (shows bottom sheet to choose list)
  const handleAddAllIngredientsToList = () => {
    openListPicker({ type: 'all' });
  };

  // Handle list selection from picker
  const handleListSelected = (listId: string) => {
    setListPickerVisible(false);

    if (pendingAction?.type === 'all') {
      executeAddAllIngredientsToList(listId);
    } else if (pendingAction?.type === 'selected') {
      // For selected ingredients flow
      executeAddSelectedIngredientsToList(listId);
    }

    setPendingAction(null);
  };

  // Create a new shopping list and add ingredients to it
  const handleCreateListAndAddIngredients = (name: string) => {
    if (!name.trim()) {
      toastService.error('List name cannot be empty');
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

        const newList = result.data?.createShoppingList?.shoppingList;
        if (!newList) {
          toastService.error('Failed to create shopping list');
          return;
        }

        setSelectedShoppingListId(newList.id);
        setListPickerVisible(false);

        if (currentPendingAction?.type === 'all') {
          executeAddAllIngredientsToList(newList.id, newList.name);
        } else if (currentPendingAction?.type === 'selected') {
          executeAddSelectedIngredientsToList(newList.id, newList.name);
        }
        setPendingAction(null);
      },
      setCreatingList,
      err => {
        console.error('Failed to create list and add ingredients:', err);
        toastService.error('Failed to create shopping list');
      },
    );
  };

  // This is called from the shopping list options bottom sheet
  // Now opens the list picker instead of directly adding
  const handleAddAllIngredients = () => {
    if (!backendRecipe || !recipeId) {
      toastService.error(
        'Cannot add ingredients from external recipes yet. Please save the recipe first.',
      );
      return;
    }
    // Set pending action, then dismiss — onDismiss will execute it
    pendingDismissActionRef.current = () => openListPicker({ type: 'all' });
    shoppingListOptionsRef.current?.dismiss();
  };

  const openIngredientSelector = () => {
    // Queue the show — once the parent options sheet finishes dismissing,
    // its onDismiss callback fires handleSheetDismiss which sets state →
    // the effect-driven present() runs after that render commit.
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

  // Opens the list picker for "Add Selected" flow
  const handleAddSelectedIngredients = () => {
    if (!backendRecipe || !recipeId) return;
    if (selectedIngredients.size === 0) {
      toastService.error('Please select at least one ingredient.');
      return;
    }

    // Set pending action, then dismiss — onDismiss will execute it
    pendingDismissActionRef.current = () =>
      openListPicker({ type: 'selected' });
    setIngredientSelectorVisible(false);
  };

  // Executes any pending action after a bottom sheet dismisses
  const handleSheetDismiss = () => {
    const action = pendingDismissActionRef.current;
    pendingDismissActionRef.current = null;
    action?.();
  };

  const handleMarkAsCooked = (input: {
    servings: number;
    deductFromPantry: boolean;
    useGranularDeduction: boolean;
    notes?: string;
  }) => {
    if (!recipeId) {
      toastService.error(
        'Cannot mark external recipes as cooked. Please save the recipe first.',
      );
      return;
    }

    // Granular deduction: load ingredient matches and open review sheet
    if (input.useGranularDeduction) {
      executeWithLoadingState(async () => {
        const loaded = await ingredientMatching.loadMatches(input.servings);
        if (!loaded) {
          // Fallback to simple deduction if matching fails
          await markRecipeAsCookedMutation({
            variables: {
              input: {
                recipeId,
                servings: input.servings,
                deductFromPantry: input.deductFromPantry,
                notes: input.notes,
              },
            },
          });
          toastService.success(
            'Recipe marked as cooked! Ingredients deducted from pantry.',
          );
        }
      }, setMarkingAsCooked);
      return;
    }

    // Simple deduction path
    executeWithLoadingState(async () => {
      await markRecipeAsCookedMutation({
        variables: {
          input: {
            recipeId,
            servings: input.servings,
            deductFromPantry: input.deductFromPantry,
            notes: input.notes,
          },
        },
      });

      if (input.deductFromPantry) {
        toastService.success(
          'Recipe marked as cooked! Ingredients deducted from pantry.',
        );
      } else {
        toastService.success('Recipe marked as cooked!');
      }
    }, setMarkingAsCooked);
  };

  // Skip review handler - falls back to simple markRecipeAsCooked with deductFromPantry: true
  const handleSkipReview = () => {
    if (!recipeId) return;
    ingredientMatching.closeSheet();
    executeWithLoadingState(async () => {
      await markRecipeAsCookedMutation({
        variables: {
          input: {
            recipeId,
            servings: undefined,
            deductFromPantry: true,
          },
        },
      });
      toastService.success(
        'Recipe marked as cooked! Ingredients deducted from pantry.',
      );
    }, setMarkingAsCooked);
  };

  // Update recipe folder
  const handleUpdateFolder = (folder: string | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    setShowFolderPicker(false);
    return executeWithLoadingState(async () => {
      await updateFavoriteRecipeMutation({
        variables: {
          recipeId,
          input: {
            folder: folder ?? undefined,
          },
        },
      });
      toastService.success(
        folder ? `Moved to "${folder}"` : 'Removed from folder',
      );
    }, setUpdatingFolderTags);
  };

  // Update recipe tags
  const handleUpdateTags = (tags: string[]): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await updateFavoriteRecipeMutation({
        variables: {
          recipeId,
          input: {
            tags,
          },
        },
      });
      toastService.success('Tags updated');
    }, setUpdatingFolderTags);
  };

  // Update recipe notes
  const handleUpdateNotes = (notes: string): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await updateFavoriteRecipeMutation({
        variables: {
          recipeId,
          input: {
            notes: notes || undefined,
          },
        },
      });
      toastService.success('Notes updated');
    }, setUpdatingFolderTags);
  };

  // Update recipe rating
  const handleUpdateRating = (rating: number | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await updateFavoriteRecipeMutation({
        variables: {
          recipeId,
          input: {
            personalRating: rating,
          },
        },
      });
      toastService.success(rating ? `Rated ${rating}/5` : 'Rating removed');
    }, setUpdatingFolderTags);
  };

  // Unfavorite (remove from saved) recipe
  const handleUnfavoriteRecipe = (): Promise<void> => {
    // For backend recipes, use recipeId
    // For external recipes, use preloadedRecipe.id from the preload cache
    const targetRecipeId = recipeId || preloadedRecipe?.id;

    if (!targetRecipeId) {
      toastService.error('Cannot remove: recipe ID not found');
      return Promise.resolve();
    }

    return executeWithLoadingState(async () => {
      await unfavoriteRecipeMutation({
        variables: { recipeId: targetRecipeId },
      });
      setRecipeSaved(false);
      setSavedFolderLocal(null);
      toastService.success('Recipe removed from saved');
    }, setUpdatingFolderTags);
  };

  // Normalize recipe data for display
  const displayData = (() => {
    if (isBackendRecipe && backendRecipe) {
      return {
        title: backendRecipe.name,
        image: backendRecipe.imageUrl ?? undefined,
        servings: backendRecipe.servings,
        readyInMinutes: backendRecipe.totalTimeMinutes ?? undefined,
        summary: backendRecipe.description ?? undefined,
        ingredients: backendRecipe.ingredients || [],
        instructions: backendRecipe.instructions,
        sourceName: backendRecipe.source ?? undefined,
        sourceUrl: backendRecipe.sourceUrl ?? undefined,
      };
    } else if (externalRecipe) {
      return {
        title: externalRecipe.title,
        image: externalRecipe.image,
        servings: externalRecipe.servings,
        readyInMinutes: externalRecipe.readyInMinutes,
        healthScore: externalRecipe.healthScore,
        summary: externalRecipe.summary,
        ingredients: externalRecipe.extendedIngredients || [],
        instructions: externalRecipe.analyzedInstructions,
        instructionsHtml: externalRecipe.instructions,
        vegetarian: externalRecipe.vegetarian,
        vegan: externalRecipe.vegan,
        glutenFree: externalRecipe.glutenFree,
        dairyFree: externalRecipe.dairyFree,
        sourceName: externalRecipe.sourceName,
        sourceUrl: externalRecipe.sourceUrl,
      };
    }
    return null;
  })();

  // Simple goBack - works for both Pantry stack and Recipe stack
  const handleGoBack = () => {
    goBack();
  };

  return {
    // Navigation
    goBack: handleGoBack,
    recipeId,
    externalId,

    // Loading/error states
    loading: loading || backendLoading,
    error,
    backendError,

    // Recipe data
    displayData,
    isBackendRecipe,
    backendRecipe,

    // Save state
    saving: saving || savingToFavorites,
    isSaved,
    handleSaveRecipe,

    // Recipe preload state
    preloading,
    preloadedRecipe,

    // Shopping list
    shoppingLists,
    addingToList,
    addedIngredients,
    selectedIngredients,
    handleAddSingleIngredient,
    handleAddAllIngredientsToList,
    handleAddAllIngredients,
    handleAddSelectedIngredients,
    handleListSelected,
    toggleIngredient,
    openIngredientSelector,
    creatingList,
    handleCreateListAndAddIngredients,

    // Bottom sheet refs and dismiss handler
    shoppingListOptionsRef,
    ingredientSelectorRef,
    listPickerRef,
    handleSheetDismiss,

    // Mark as cooked
    cookedModalVisible,
    setCookedModalVisible,
    markingAsCooked,
    handleMarkAsCooked,
    handleSkipReview,
    ingredientMatching,

    // Folder/tag editing
    showFolderPicker,
    setShowFolderPicker,
    updatingFolderTags,
    handleUpdateFolder,
    handleUpdateTags,
    handleUpdateNotes,
    handleUpdateRating,
    savedFolder: isBackendRecipe
      ? backendRecipe?.savedDetails?.folder ?? null
      : savedFolderLocal,
    savedTags: backendRecipe?.savedDetails?.tags ?? [],
    savedNotes: backendRecipe?.savedDetails?.notes ?? null,
    savedRating: backendRecipe?.savedDetails?.personalRating ?? null,
    cookedCount: backendRecipe?.savedDetails?.cookedCount ?? 0,

    // Unfavorite
    handleUnfavoriteRecipe,
  };
}
