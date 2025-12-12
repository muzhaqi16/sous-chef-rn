import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import type { RecipeStackParamList } from '#/navigation/stacks/RecipeStack';
import { spoonacularService } from '#/services/recipeApi';
import type { RecipeInformation } from '#/services/recipeApi/types';
import {
  useCreateRecipeMutation,
  useGetRecipeQuery,
  useCreateShoppingListItemsFromRecipeMutation,
  useCreateShoppingListItemFromRecipeIngredientMutation,
  useAddItemToShoppingListMutation,
  useGetShoppingListsQuery,
  useMyRecipesQuery,
  useMarkRecipeAsCookedMutation,
} from '#generated';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useAppNavigation } from '#/hooks';
import { normalizeRecipes } from '#/utils/connectionUtils';
import {
  createAddToParentConnectionUpdater,
  createAddToQueryFieldUpdater,
} from '#/apollo/utils';
import { toastService } from '#/services/toastService';

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
  const { goBack } = useAppNavigation();
  const { recipeId, externalSource, externalId } = route.params;

  // Get shopping lists
  const { data: shoppingListsData } = useGetShoppingListsQuery({
    fetchPolicy: 'cache-and-network',
  });
  const shoppingLists = useMemo(
    () => shoppingListsData?.shoppingLists || [],
    [shoppingListsData],
  );

  // Helper to get default shopping list
  const getDefaultShoppingList = useCallback(() => {
    if (shoppingLists.length === 0) return null;
    return shoppingLists[0];
  }, [shoppingLists]);

  // State for external recipes
  const [loading, setLoading] = useState(true);
  const [externalRecipe, setExternalRecipe] = useState<RecipeInformation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recipeSaved, setRecipeSaved] = useState(false);

  // State for shopping list
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  const [addingToList, setAddingToList] = useState(false);
  const [addedIngredients, setAddedIngredients] = useState<Set<string | number>>(new Set());

  // State for mark as cooked modal
  const [cookedModalVisible, setCookedModalVisible] = useState(false);
  const [markingAsCooked, setMarkingAsCooked] = useState(false);

  // Refs for bottom sheets
  const shoppingListOptionsRef = useRef<BottomSheetModal>(null);
  const ingredientSelectorRef = useRef<BottomSheetModal>(null);

  // Mutations
  const [saveRecipeMutation] = useCreateRecipeMutation({
    update: (cache, { data }) => {
      if (!data?.createRecipe) return;
      try {
        const addToRecipesCache = createAddToQueryFieldUpdater('recipes');
        addToRecipesCache(cache, data.createRecipe, { position: 'start' });
      } catch (err) {
        console.warn('Cache update failed for saveRecipe:', err);
      }
    },
    onError: err => {
      console.error('Save recipe error:', err);
      const errorMessage = err.message || 'Failed to save recipe. Please try again.';
      Alert.alert('Error', `Could not save recipe: ${errorMessage}`);
    },
  });

  const [addRecipeToShoppingListMutation] = useCreateShoppingListItemsFromRecipeMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.createShoppingListItemsFromRecipe || !variables) return;
      try {
        const result = data.createShoppingListItemsFromRecipe;
        const shoppingListId = variables.shoppingListId;
        const addToShoppingListItemsCache = createAddToParentConnectionUpdater(
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
      const errorMessage = err.message || 'Failed to add ingredients to shopping list';
      Alert.alert('Error', `Could not add ingredients: ${errorMessage}`);
    },
  });

  const [addRecipeIngredientMutation] = useCreateShoppingListItemFromRecipeIngredientMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.createShoppingListItemFromRecipeIngredient || !variables) return;
      try {
        const result = data.createShoppingListItemFromRecipeIngredient;
        const shoppingListId = variables.shoppingListId;
        if (!result.wasUpdated) {
          const addToShoppingListItemsCache = createAddToParentConnectionUpdater(
            'ShoppingList',
            'itemsConnection',
            'ShoppingListItem',
          );
          addToShoppingListItemsCache(cache, shoppingListId, result.shoppingListItem);
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

  const [markRecipeAsCookedMutation] = useMarkRecipeAsCookedMutation({
    onError: err => {
      console.error('Mark recipe as cooked error:', err);
      toastService.error(err.message || 'Failed to mark recipe as cooked');
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
  }, [externalSource, externalId, recipeId, backendLoading]);

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
      return;
    }

    const isAlreadySaved = savedRecipes.some(
      (recipe: any) =>
        recipe.externalSource === externalSource &&
        recipe.externalId === externalId,
    );
    setRecipeSaved(isAlreadySaved);
  }, [externalSource, externalId, savedRecipes]);

  const isBackendRecipe = !!recipeId && !!backendRecipe;

  const handleSaveRecipe = async () => {
    if (!externalRecipe || !externalSource || !externalId) return;

    setSaving(true);

    try {
      const ingredients = externalRecipe.extendedIngredients?.map(ing => ({
        name: ing.name,
        quantity: ing.amount || 0,
        spoonacularIngredientId: ing.id,
        originalString: ing.original,
        aisle: ing.aisle,
        consistency: ing.consistency,
        image: ing.image,
        metricAmount: ing.measures?.metric?.amount,
        metricUnit: ing.measures?.metric?.unitShort,
        usAmount: ing.measures?.us?.amount,
        usUnit: ing.measures?.us?.unitShort,
        meta: ing.meta || [],
      })) || [];

      const instructions = externalRecipe.analyzedInstructions?.[0]?.steps?.map(step => ({
        number: step.number,
        step: step.step,
      })) || [];

      await saveRecipeMutation({
        variables: {
          input: {
            source: externalSource,
            externalSourceId: externalId,
            externalSourceUrl: externalRecipe.sourceUrl,
            externalSourceData: externalRecipe,
            name: externalRecipe.title,
            ingredients,
            instructions: instructions as any,
            servings: externalRecipe.servings,
            prepTimeMinutes: externalRecipe.preparationMinutes,
            cookTimeMinutes: externalRecipe.cookingMinutes,
            imageUrl: externalRecipe.image,
            description: externalRecipe.summary?.replace(/<[^>]*>/g, ''),
            cuisine: externalRecipe.cuisines?.join(', '),
            caloriesPerServing: externalRecipe.nutrition?.nutrients?.find(
              n => n.name === 'Calories',
            )?.amount,
          },
        },
      });

      setRecipeSaved(true);
    } catch (err: any) {
      console.error('Failed to save recipe:', err);
      toastService.error('Failed to save recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSingleIngredient = useCallback(
    async (ingredient: any) => {
      const defaultShoppingList = getDefaultShoppingList();
      if (!defaultShoppingList) {
        toastService.error('Please create a shopping list first.');
        return;
      }

      try {
        if (isBackendRecipe) {
          await addRecipeIngredientMutation({
            variables: {
              recipeIngredientId: ingredient.id,
              shoppingListId: defaultShoppingList.id,
            },
          });
        } else {
          await addItemToShoppingListMutation({
            variables: {
              input: {
                itemName: ingredient.name || ingredient.originalString || 'Unknown ingredient',
                quantity: ingredient.amount || 0,
                unitName: ingredient.measures?.us?.unitShort || ingredient.measures?.metric?.unitShort || '',
                shoppingListId: defaultShoppingList.id,
                aisle: ingredient.aisle || '',
              },
            },
          });
        }

        setAddedIngredients(prev => new Set(prev).add(ingredient.id));
      } catch (err) {
        console.error('Failed to add ingredient:', err);
        toastService.error('Failed to add ingredient to shopping list.');
      }
    },
    [isBackendRecipe, getDefaultShoppingList, addItemToShoppingListMutation, addRecipeIngredientMutation],
  );

  const handleAddAllIngredientsToList = useCallback(async () => {
    const defaultShoppingList = getDefaultShoppingList();
    if (!defaultShoppingList) {
      toastService.error('Please create a shopping list first.');
      return;
    }

    setAddingToList(true);

    try {
      if (isBackendRecipe && backendRecipe && recipeId) {
        const result = await addRecipeToShoppingListMutation({
          variables: {
            recipeId,
            shoppingListId: defaultShoppingList.id,
            servings: backendRecipe.servings,
          },
        });

        const data = result.data?.createShoppingListItemsFromRecipe;
        if (data) {
          const allIngredientIds = backendRecipe.ingredients.map(ing => ing.id);
          setAddedIngredients(prev => {
            const next = new Set(prev);
            allIngredientIds.forEach(id => next.add(id));
            return next;
          });
        }
      } else if (externalRecipe?.extendedIngredients) {
        const successfullyAddedIds: number[] = [];

        for (const ingredient of externalRecipe.extendedIngredients) {
          try {
            await addItemToShoppingListMutation({
              variables: {
                input: {
                  itemName: ingredient.name || ingredient.original || 'Unknown ingredient',
                  quantity: ingredient.amount || 0,
                  unitName: ingredient.measures?.us?.unitShort || ingredient.measures?.metric?.unitShort || '',
                  shoppingListId: defaultShoppingList.id,
                  aisle: ingredient.aisle || '',
                },
              },
            });
            successfullyAddedIds.push(ingredient.id);
          } catch (err) {
            console.error('Failed to add ingredient:', ingredient.name, err);
          }
        }

        setAddedIngredients(prev => {
          const next = new Set(prev);
          successfullyAddedIds.forEach(id => next.add(id));
          return next;
        });
      } else {
        toastService.error('No ingredients available to add.');
      }
    } catch (err) {
      console.error('Failed to add ingredients:', err);
      toastService.error('Failed to add ingredients to shopping list.');
    } finally {
      setAddingToList(false);
    }
  }, [
    isBackendRecipe,
    backendRecipe,
    recipeId,
    externalRecipe,
    getDefaultShoppingList,
    addItemToShoppingListMutation,
    addRecipeToShoppingListMutation,
  ]);

  const handleAddAllIngredients = useCallback(async () => {
    if (!backendRecipe || !recipeId) {
      toastService.error('Cannot add ingredients from external recipes yet. Please save the recipe first.');
      return;
    }

    const defaultShoppingList = getDefaultShoppingList();
    if (!defaultShoppingList) {
      toastService.error('Please create a shopping list first.');
      return;
    }

    setAddingToList(true);
    shoppingListOptionsRef.current?.dismiss();

    try {
      const result = await addRecipeToShoppingListMutation({
        variables: {
          recipeId,
          shoppingListId: defaultShoppingList.id,
          servings: backendRecipe.servings,
        },
      });

      const data = result.data?.createShoppingListItemsFromRecipe;
      if (data) {
        toastService.success(
          `Added ${data.totalAdded} items, updated ${data.totalUpdated} items${
            data.totalSkipped > 0 ? `, skipped ${data.totalSkipped} items` : ''
          }`,
        );
      }
    } catch (err) {
      console.error('Failed to add ingredients:', err);
      toastService.error('Failed to add ingredients to shopping list.');
    } finally {
      setAddingToList(false);
    }
  }, [backendRecipe, recipeId, getDefaultShoppingList, addRecipeToShoppingListMutation]);

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

  const handleAddSelectedIngredients = useCallback(async () => {
    if (!backendRecipe || !recipeId) return;
    if (selectedIngredients.size === 0) {
      toastService.error('Please select at least one ingredient.');
      return;
    }

    const defaultShoppingList = getDefaultShoppingList();
    if (!defaultShoppingList) {
      toastService.error('Please create a shopping list first.');
      return;
    }

    setAddingToList(true);
    ingredientSelectorRef.current?.dismiss();

    try {
      let addedCount = 0;
      let updatedCount = 0;

      for (const ingredientId of selectedIngredients) {
        const result = await addRecipeIngredientMutation({
          variables: {
            recipeIngredientId: ingredientId,
            shoppingListId: defaultShoppingList.id,
          },
        });

        if (result.data?.createShoppingListItemFromRecipeIngredient) {
          const wasUpdated = result.data.createShoppingListItemFromRecipeIngredient.wasUpdated;
          if (wasUpdated) {
            updatedCount++;
          } else {
            addedCount++;
          }
        }
      }

      toastService.success(`Added ${addedCount} new items, updated ${updatedCount} existing items`);
      setSelectedIngredients(new Set());
    } catch (err) {
      console.error('Failed to add selected ingredients:', err);
      toastService.error('Failed to add ingredients to shopping list.');
    } finally {
      setAddingToList(false);
    }
  }, [backendRecipe, recipeId, selectedIngredients, getDefaultShoppingList, addRecipeIngredientMutation]);

  const handleMarkAsCooked = useCallback(
    async (input: { servings: number; deductFromPantry: boolean; notes?: string }) => {
      if (!recipeId) {
        toastService.error('Cannot mark external recipes as cooked. Please save the recipe first.');
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
          toastService.success('Recipe marked as cooked! Ingredients deducted from pantry.');
        } else {
          toastService.success('Recipe marked as cooked!');
        }
      } catch (err) {
        // Error handled by mutation onError
      } finally {
        setMarkingAsCooked(false);
      }
    },
    [recipeId, markRecipeAsCookedMutation],
  );

  // Normalize recipe data for display
  const displayData = useMemo((): RecipeDisplayData | null => {
    if (isBackendRecipe && backendRecipe) {
      return {
        title: backendRecipe.name,
        image: backendRecipe.imageUrl,
        servings: backendRecipe.servings,
        readyInMinutes: backendRecipe.totalTimeMinutes,
        summary: backendRecipe.description,
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

  return {
    // Navigation
    goBack,
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
    saving,
    recipeSaved,
    handleSaveRecipe,

    // Shopping list
    addingToList,
    addedIngredients,
    selectedIngredients,
    handleAddSingleIngredient,
    handleAddAllIngredientsToList,
    handleAddAllIngredients,
    handleAddSelectedIngredients,
    toggleIngredient,
    openIngredientSelector,

    // Bottom sheet refs
    shoppingListOptionsRef,
    ingredientSelectorRef,

    // Mark as cooked
    cookedModalVisible,
    setCookedModalVisible,
    markingAsCooked,
    handleMarkAsCooked,
  };
}
