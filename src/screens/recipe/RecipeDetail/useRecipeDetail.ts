import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRoute, RouteProp } from '@react-navigation/native';
import type { RecipeStackParamList } from '#/navigation/stacks/RecipeStack';
import { spoonacularService } from '#/services/recipeApi';
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
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
  type BatchAddShoppingListItemInput,
} from '#generated';
import { useAppStore, selectSelectedShoppingListId } from '#store/useAppStore';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCrossTabNavigation, type CrossTabSource } from '#/hooks';
import { normalizeRecipes, extractNodes } from '#/utils/connectionUtils';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';
import { toastService } from '#/services/toastService';
import { useRecipePreload } from '#/hooks/recipe';

type RecipeDetailRouteProp = RouteProp<RecipeStackParamList, 'RecipeDetail'>;

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

export function useRecipeDetail() {
  const route = useRoute<RecipeDetailRouteProp>();
  const { goBackToSource } = useCrossTabNavigation('RecipeMain');
  const {
    recipeId,
    externalSource,
    externalId,
    sourceTab,
    sourcePantryItemId,
  } = route.params;

  // Get shopping lists - uses lightweight query for list metadata only
  const { data: shoppingListsData, loading: shoppingListsLoading } =
    useGetShoppingListsLiteQuery({
      fetchPolicy: 'cache-and-network',
    });
  // Extract nodes from connection type (shoppingLists returns ShoppingListConnection)
  const shoppingLists = useMemo(
    () => extractNodes(shoppingListsData?.shoppingLists),
    [shoppingListsData],
  );

  // Get user's selected shopping list ID from app store
  const selectedShoppingListId = useAppStore(selectSelectedShoppingListId);

  // Helper to get the target list for single ingredient adds
  // Priority: user's selected list > default list > first list
  const getTargetShoppingList = useCallback(() => {
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
  }, [shoppingLists, selectedShoppingListId]);

  // Helper to get list by ID
  const getShoppingListById = useCallback(
    (listId: string) => {
      return shoppingLists.find(list => list.id === listId) || null;
    },
    [shoppingLists],
  );

  // Open list picker for "Add All" flow
  const openListPicker = useCallback(
    (action: { type: 'all' | 'selected' }) => {
      if (shoppingListsLoading) {
        toastService.info('Loading shopping lists...');
        return;
      }
      if (shoppingLists.length === 0) {
        toastService.error('Please create a shopping list first.');
        return;
      }
      setPendingAction(action);
      listPickerRef.current?.present();
    },
    [shoppingLists.length, shoppingListsLoading],
  );

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

  // Mutations
  const [addRecipeToShoppingListMutation] =
    useCreateShoppingListItemsFromRecipeMutation({
      update: (cache, { data }, { variables }) => {
        if (!data?.createShoppingListItemsFromRecipe || !variables) return;
        try {
          const result = data.createShoppingListItemsFromRecipe;
          const shoppingListId = variables.shoppingListId;
          const addToShoppingListItemsCache =
            createAddToParentConnectionUpdater(
              'ShoppingList',
              'itemsConnection',
              'ShoppingListItem',
            );
          result.addedItems.forEach((item: any) => {
            addToShoppingListItemsCache(cache, shoppingListId, item);
          });
        } catch (err) {
          console.warn('Cache update failed for addRecipeToShoppingList:', err);
        }
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
        try {
          const result = data.createShoppingListItemFromRecipeIngredient;
          const shoppingListId = variables.shoppingListId;
          if (!result.wasUpdated) {
            const addToShoppingListItemsCache =
              createAddToParentConnectionUpdater(
                'ShoppingList',
                'itemsConnection',
                'ShoppingListItem',
              );
            addToShoppingListItemsCache(
              cache,
              shoppingListId,
              result.shoppingListItem,
            );
          }
        } catch (err) {
          console.warn('Cache update failed for addRecipeIngredient:', err);
        }
      },
    });

  const [addItemToShoppingListMutation] = useAddItemToShoppingListMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.addItemToShoppingList || !variables) return;
      try {
        const item = data.addItemToShoppingList;
        const shoppingListId = variables.input.shoppingListId;
        const addToShoppingListItemsCache = createAddToParentConnectionUpdater(
          'ShoppingList',
          'itemsConnection',
          'ShoppingListItem',
        );
        addToShoppingListItemsCache(cache, shoppingListId, item);
      } catch (err) {
        console.warn('Cache update failed for addItemToShoppingList:', err);
      }
    },
  });

  const [addItemsToShoppingListMutation] = useAddItemsToShoppingListMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.addItemsToShoppingList || !variables) return;
      try {
        const { results } = data.addItemsToShoppingList;
        const shoppingListId = variables.shoppingListId;
        const addToShoppingListItemsCache = createAddToParentConnectionUpdater(
          'ShoppingList',
          'itemsConnection',
          'ShoppingListItem',
        );
        // Add each successfully created item to the cache
        results.forEach(result => {
          if (result.success && result.item) {
            addToShoppingListItemsCache(cache, shoppingListId, result.item);
          }
        });
      } catch (err) {
        console.warn('Cache update failed for addItemsToShoppingList:', err);
      }
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
      if (!data?.updateFavoriteRecipe) return;

      // Update SavedRecipeFolders cache if a folder was set
      const folder = data.updateFavoriteRecipe.folder;
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
          if (!existing) return existing;
          return {
            ...existing,
            mySavedRecipes: existing.mySavedRecipes.map(sr =>
              sr.id === data.updateFavoriteRecipe.id
                ? { ...sr, ...data.updateFavoriteRecipe }
                : sr,
            ),
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
      if (!data?.unfavoriteRecipe || !variables?.recipeId) return;

      // 1. Remove from mySavedRecipes array
      cache.updateQuery<MySavedRecipesQuery>(
        { query: MySavedRecipesDocument },
        existing => {
          if (!existing) return existing;
          return {
            ...existing,
            mySavedRecipes: existing.mySavedRecipes.filter(
              sr => sr.recipe.id !== variables.recipeId,
            ),
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
    const fetchRecipe = async () => {
      if (recipeId) {
        setLoading(backendLoading);
        return;
      }

      if (!externalSource || !externalId) {
        setError('Recipe not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (externalSource === 'SPOONACULAR') {
          const data = await spoonacularService.getRecipeInformation({
            id: Number(externalId),
            includeNutrition: true,
          });
          setExternalRecipe(data);

          // Preload recipe to backend (fire-and-forget)
          // Backend handles recipe storage and ingredient enrichment
          preloadRecipe(data).catch(() => {
            // Ignore errors - fire and forget
          });
        } else {
          throw new Error(`Unsupported external source: ${externalSource}`);
        }
      } catch (err: any) {
        console.error('Failed to fetch recipe:', err);
        setError('Failed to load recipe. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [externalSource, externalId, recipeId, backendLoading, preloadRecipe]);

  // Normalize recipes data
  const normalizedRecipes = useMemo(
    () => normalizeRecipes(myRecipesData?.recipes),
    [myRecipesData?.recipes],
  );
  const savedRecipes = useMemo(
    () => normalizedRecipes?.recipes || [],
    [normalizedRecipes],
  );

  // Check if current external recipe is already saved
  useEffect(() => {
    if (!externalSource || !externalId || savedRecipes.length === 0) {
      setRecipeSaved(false);
      setSavedFolderLocal(null); // Reset local folder when recipe is not saved
      return;
    }

    const savedRecipe = savedRecipes.find(
      (recipe: any) =>
        recipe.externalSource === externalSource &&
        recipe.externalId === externalId,
    );

    if (savedRecipe) {
      setRecipeSaved(true);
      // Try to get folder from the saved recipe data if available
      setSavedFolderLocal(savedRecipe.savedDetails?.folder ?? null);
    } else {
      setRecipeSaved(false);
      setSavedFolderLocal(null);
    }
  }, [externalSource, externalId, savedRecipes]);

  const isBackendRecipe = !!recipeId && !!backendRecipe;

  // For backend recipes, derive saved state from savedDetails
  // savedDetails is non-null when the recipe is in user's favorites
  const isSaved = isBackendRecipe ? !!backendRecipe?.savedDetails : recipeSaved;

  const handleSaveRecipe = useCallback(
    async (folder?: string | null, tags?: string[], notes?: string) => {
      if (!externalRecipe || !externalSource || !externalId) return;

      setSaving(true);

      try {
        // Use the new saveRecipeToFavorites which handles creating the recipe
        // and adding it to favorites in one flow
        const result = await saveRecipeToFavorites(externalRecipe, {
          folder: folder ?? undefined,
          tags: tags && tags.length > 0 ? tags : undefined,
          notes: notes || undefined,
        });

        if (result.success) {
          setRecipeSaved(true);
          setSavedFolderLocal(folder ?? null); // Track the folder locally for external recipes
          // Toast is shown by the hook
        }
      } catch (err: any) {
        console.error('Failed to save recipe:', err);
        // Error toast is shown by the hook
      } finally {
        setSaving(false);
      }
    },
    [externalRecipe, externalSource, externalId, saveRecipeToFavorites],
  );

  // Add single ingredient to user's selected/default list (no picker)
  const handleAddSingleIngredient = useCallback(
    async (ingredient: any) => {
      const targetList = getTargetShoppingList();
      if (!targetList) {
        toastService.error('Please create a shopping list first.');
        return;
      }

      try {
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
                unitName:
                  ingredient.measures?.us?.unitShort ||
                  ingredient.measures?.metric?.unitShort ||
                  '',
                shoppingListId: targetList.id,
                aisle: ingredient.aisle || '',
              },
            },
          });
        }

        setAddedIngredients(prev => new Set(prev).add(ingredient.id));
        toastService.success(`Added to "${targetList.name}"`);
      } catch (err) {
        console.error('Failed to add ingredient:', err);
        toastService.error('Failed to add ingredient to shopping list.');
      }
    },
    [
      isBackendRecipe,
      getTargetShoppingList,
      addItemToShoppingListMutation,
      addRecipeIngredientMutation,
    ],
  );

  // Execute adding all ingredients to a specific list (called after list selection)
  const executeAddAllIngredientsToList = useCallback(
    async (listId: string) => {
      const targetList = getShoppingListById(listId);
      if (!targetList) {
        toastService.error('Shopping list not found.');
        return;
      }

      setAddingToList(true);

      try {
        if (isBackendRecipe && backendRecipe && recipeId) {
          const result = await addRecipeToShoppingListMutation({
            variables: {
              recipeId,
              shoppingListId: targetList.id,
              servings: backendRecipe.servings,
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
              `Added ${data.totalAdded} items to "${targetList.name}"${
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
              unitName:
                ingredient.measures?.us?.unitShort ||
                ingredient.measures?.metric?.unitShort ||
                '',
              aisle: ingredient.aisle || '',
            }));

          const result = await addItemsToShoppingListMutation({
            variables: {
              shoppingListId: targetList.id,
              items,
            },
          });

          const data = result.data?.addItemsToShoppingList;
          if (data) {
            // Mark successfully added ingredients
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
              `Added ${totalAdded} items to "${targetList.name}"${
                totalIncremented > 0 ? `, updated ${totalIncremented}` : ''
              }`,
            );
          }
        } else {
          toastService.error('No ingredients available to add.');
        }
      } catch (err) {
        console.error('Failed to add ingredients:', err);
        toastService.error('Failed to add ingredients to shopping list.');
      } finally {
        setAddingToList(false);
      }
    },
    [
      isBackendRecipe,
      backendRecipe,
      recipeId,
      externalRecipe,
      getShoppingListById,
      addItemsToShoppingListMutation,
      addRecipeToShoppingListMutation,
    ],
  );

  // Execute adding selected ingredients to a specific list (called after list selection)
  const executeAddSelectedIngredientsToList = useCallback(
    async (listId: string) => {
      if (!backendRecipe || !recipeId) return;

      const targetList = getShoppingListById(listId);
      if (!targetList) {
        toastService.error('Shopping list not found.');
        return;
      }

      setAddingToList(true);

      try {
        let addedCount = 0;
        let updatedCount = 0;

        for (const ingredientId of selectedIngredients) {
          const result = await addRecipeIngredientMutation({
            variables: {
              recipeIngredientId: ingredientId,
              shoppingListId: targetList.id,
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
          `Added ${addedCount} items to "${targetList.name}"${
            updatedCount > 0 ? `, updated ${updatedCount}` : ''
          }`,
        );
        setSelectedIngredients(new Set());
      } catch (err) {
        console.error('Failed to add selected ingredients:', err);
        toastService.error('Failed to add ingredients to shopping list.');
      } finally {
        setAddingToList(false);
      }
    },
    [
      backendRecipe,
      recipeId,
      selectedIngredients,
      getShoppingListById,
      addRecipeIngredientMutation,
    ],
  );

  // Open list picker for "Add All" (shows bottom sheet to choose list)
  const handleAddAllIngredientsToList = useCallback(() => {
    openListPicker({ type: 'all' });
  }, [openListPicker]);

  // Handle list selection from picker
  const handleListSelected = useCallback(
    (listId: string) => {
      listPickerRef.current?.dismiss();

      if (pendingAction?.type === 'all') {
        executeAddAllIngredientsToList(listId);
      } else if (pendingAction?.type === 'selected') {
        // For selected ingredients flow
        executeAddSelectedIngredientsToList(listId);
      }

      setPendingAction(null);
    },
    [
      pendingAction,
      executeAddAllIngredientsToList,
      executeAddSelectedIngredientsToList,
    ],
  );

  // This is called from the shopping list options bottom sheet
  // Now opens the list picker instead of directly adding
  const handleAddAllIngredients = useCallback(() => {
    if (!backendRecipe || !recipeId) {
      toastService.error(
        'Cannot add ingredients from external recipes yet. Please save the recipe first.',
      );
      return;
    }
    shoppingListOptionsRef.current?.dismiss();
    // Small delay to let first sheet close before opening picker
    setTimeout(() => {
      openListPicker({ type: 'all' });
    }, 200);
  }, [backendRecipe, recipeId, openListPicker]);

  const openIngredientSelector = useCallback(() => {
    shoppingListOptionsRef.current?.dismiss();
    setTimeout(() => {
      ingredientSelectorRef.current?.present();
    }, 300);
  }, []);

  const toggleIngredient = useCallback((ingredientId: string) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  }, []);

  // Opens the list picker for "Add Selected" flow
  const handleAddSelectedIngredients = useCallback(() => {
    if (!backendRecipe || !recipeId) return;
    if (selectedIngredients.size === 0) {
      toastService.error('Please select at least one ingredient.');
      return;
    }

    ingredientSelectorRef.current?.dismiss();
    // Small delay to let first sheet close before opening picker
    setTimeout(() => {
      openListPicker({ type: 'selected' });
    }, 200);
  }, [backendRecipe, recipeId, selectedIngredients.size, openListPicker]);

  const handleMarkAsCooked = useCallback(
    async (input: {
      servings: number;
      deductFromPantry: boolean;
      notes?: string;
    }) => {
      if (!recipeId) {
        toastService.error(
          'Cannot mark external recipes as cooked. Please save the recipe first.',
        );
        return;
      }

      setMarkingAsCooked(true);

      try {
        await markRecipeAsCookedMutation({
          variables: {
            recipeId,
            servings: input.servings,
            deductFromPantry: input.deductFromPantry,
            notes: input.notes,
          },
        });

        if (input.deductFromPantry) {
          toastService.success(
            'Recipe marked as cooked! Ingredients deducted from pantry.',
          );
        } else {
          toastService.success('Recipe marked as cooked!');
        }
      } catch {
        // Error handled by mutation onError
      } finally {
        setMarkingAsCooked(false);
      }
    },
    [recipeId, markRecipeAsCookedMutation],
  );

  // Update recipe folder
  const handleUpdateFolder = useCallback(
    async (folder: string | null) => {
      if (!recipeId) return;

      setUpdatingFolderTags(true);
      setShowFolderPicker(false);

      try {
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
      } catch {
        // Error handled by mutation onError
      } finally {
        setUpdatingFolderTags(false);
      }
    },
    [recipeId, updateFavoriteRecipeMutation],
  );

  // Update recipe tags
  const handleUpdateTags = useCallback(
    async (tags: string[]) => {
      if (!recipeId) return;

      setUpdatingFolderTags(true);

      try {
        await updateFavoriteRecipeMutation({
          variables: {
            recipeId,
            input: {
              tags,
            },
          },
        });
        toastService.success('Tags updated');
      } catch {
        // Error handled by mutation onError
      } finally {
        setUpdatingFolderTags(false);
      }
    },
    [recipeId, updateFavoriteRecipeMutation],
  );

  // Update recipe notes
  const handleUpdateNotes = useCallback(
    async (notes: string) => {
      if (!recipeId) return;

      setUpdatingFolderTags(true);

      try {
        await updateFavoriteRecipeMutation({
          variables: {
            recipeId,
            input: {
              notes: notes || undefined,
            },
          },
        });
        toastService.success('Notes updated');
      } catch {
        // Error handled by mutation onError
      } finally {
        setUpdatingFolderTags(false);
      }
    },
    [recipeId, updateFavoriteRecipeMutation],
  );

  // Update recipe rating
  const handleUpdateRating = useCallback(
    async (rating: number | null) => {
      if (!recipeId) return;

      setUpdatingFolderTags(true);

      try {
        await updateFavoriteRecipeMutation({
          variables: {
            recipeId,
            input: {
              personalRating: rating,
            },
          },
        });
        toastService.success(rating ? `Rated ${rating}/5` : 'Rating removed');
      } catch {
        // Error handled by mutation onError
      } finally {
        setUpdatingFolderTags(false);
      }
    },
    [recipeId, updateFavoriteRecipeMutation],
  );

  // Unfavorite (remove from saved) recipe
  const handleUnfavoriteRecipe = useCallback(async () => {
    // For backend recipes, use recipeId
    // For external recipes, use preloadedRecipe.id from the preload cache
    const targetRecipeId = recipeId || preloadedRecipe?.id;

    if (!targetRecipeId) {
      toastService.error('Cannot remove: recipe ID not found');
      return;
    }

    setUpdatingFolderTags(true);

    try {
      await unfavoriteRecipeMutation({
        variables: { recipeId: targetRecipeId },
      });
      setRecipeSaved(false);
      setSavedFolderLocal(null); // Clear local folder tracking
      toastService.success('Recipe removed from saved');
    } catch {
      // Error handled by mutation onError
    } finally {
      setUpdatingFolderTags(false);
    }
  }, [recipeId, preloadedRecipe?.id, unfavoriteRecipeMutation]);

  // Normalize recipe data for display
  const displayData = useMemo((): RecipeDisplayData | null => {
    if (isBackendRecipe && backendRecipe) {
      return {
        title: backendRecipe.name,
        image: backendRecipe.imageUrl ?? undefined,
        servings: backendRecipe.servings,
        readyInMinutes: backendRecipe.totalTimeMinutes ?? undefined,
        summary: backendRecipe.description ?? undefined,
        ingredients: backendRecipe.ingredients || [],
        instructions: backendRecipe.instructions,
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
  }, [isBackendRecipe, backendRecipe, externalRecipe]);

  // Smart goBack that handles cross-tab navigation
  const handleGoBack = useCallback(() => {
    const source: CrossTabSource | undefined = sourceTab
      ? {
          sourceTab,
          sourceScreen: sourcePantryItemId ? 'PantryItemDetail' : undefined,
          sourceParams: sourcePantryItemId
            ? { itemId: sourcePantryItemId }
            : undefined,
        }
      : undefined;

    goBackToSource(source);
  }, [sourceTab, sourcePantryItemId, goBackToSource]);

  return {
    // Navigation
    goBack: handleGoBack,
    recipeId,

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

    // Bottom sheet refs
    shoppingListOptionsRef,
    ingredientSelectorRef,
    listPickerRef,

    // Mark as cooked
    cookedModalVisible,
    setCookedModalVisible,
    markingAsCooked,
    handleMarkAsCooked,

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
