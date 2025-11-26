import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useRoute, RouteProp } from '@react-navigation/native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
} from '#generated';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetAction } from '#components';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppNavigation } from '#/hooks';
import { normalizeRecipes } from '#/utils/connectionUtils';
import {
  createAddToParentConnectionUpdater,
  createAddToQueryFieldUpdater,
} from '#/apollo/utils';
import { toastService } from '#/services/toastService';
import { RecipeDetailErrorBoundary } from '#/components/providers/ScreenErrorBoundary';

type RecipeDetailRouteProp = RouteProp<RecipeStackParamList, 'RecipeDetail'>;

const RecipeDetailScreen: React.FC = () => {
  const route = useRoute<RecipeDetailRouteProp>();
  const { theme } = useUnistyles();
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
    // Find the first active shopping list (you could also look for isDefault flag if available)
    return shoppingLists[0];
  }, [shoppingLists]);

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

  // Refs for bottom sheets
  const shoppingListOptionsRef = useRef<BottomSheetModal>(null);
  const ingredientSelectorRef = useRef<BottomSheetModal>(null);

  // Scroll animation for parallax effect
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Parallax style for recipe image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollY.value,
      [0, 300],
      [1, 0.95],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ scale }],
    };
  });

  // Mutations
  const [saveRecipeMutation] = useCreateRecipeMutation({
    update: (cache, { data }) => {
      if (!data?.createRecipe) return;

      try {
        // Add the new recipe to the recipes connection
        const addToRecipesCache = createAddToQueryFieldUpdater('recipes');
        addToRecipesCache(cache, data.createRecipe, { position: 'start' });
      } catch (error) {
        console.warn('Cache update failed for saveRecipe:', error);
      }
    },
    onError: error => {
      console.error('Save recipe error:', error);
      const errorMessage =
        error.message || 'Failed to save recipe. Please try again.';
      Alert.alert('Error', `Could not save recipe: ${errorMessage}`);
    },
  });
  const [addRecipeToShoppingListMutation] =
    useCreateShoppingListItemsFromRecipeMutation({
      update: (cache, { data }, { variables }) => {
        if (!data?.createShoppingListItemsFromRecipe || !variables) return;

        try {
          // The mutation returns AddRecipeToShoppingListResult with addedItems and updatedItems arrays
          const result = data.createShoppingListItemsFromRecipe;
          const shoppingListId = variables.shoppingListId;
          const addToShoppingListItemsCache = createAddToParentConnectionUpdater(
            'ShoppingList',
            'itemsConnection',
            'ShoppingListItem',
          );

          // Add newly added items to the cache
          result.addedItems.forEach((item: any) => {
            addToShoppingListItemsCache(cache, shoppingListId, item);
          });
          // Updated items are already in cache via normalization, no manual update needed
        } catch (error) {
          console.warn('Cache update failed for addRecipeToShoppingList:', error);
        }
      },
      onError: error => {
        console.error('Add recipe to shopping list error:', error);
        const errorMessage =
          error.message || 'Failed to add ingredients to shopping list';
        Alert.alert('Error', `Could not add ingredients: ${errorMessage}`);
      },
    });
  const [addRecipeIngredientMutation] =
    useCreateShoppingListItemFromRecipeIngredientMutation({
      update: (cache, { data }, { variables }) => {
        if (!data?.createShoppingListItemFromRecipeIngredient || !variables) return;

        try {
          // The mutation returns AddIngredientResult with a shoppingListItem
          const result = data.createShoppingListItemFromRecipeIngredient;
          const shoppingListId = variables.shoppingListId;

          // Only add to cache if it's a new item (not an update)
          if (!result.wasUpdated) {
            const addToShoppingListItemsCache = createAddToParentConnectionUpdater(
              'ShoppingList',
              'itemsConnection',
              'ShoppingListItem',
            );
            addToShoppingListItemsCache(cache, shoppingListId, result.shoppingListItem);
          }
          // If wasUpdated=true, the item is already in cache via normalization
        } catch (error) {
          console.warn('Cache update failed for addRecipeIngredient:', error);
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
      } catch (error) {
        console.warn('Cache update failed for addItemToShoppingList:', error);
      }
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
    skip: !externalSource || !externalId, // Only fetch if viewing an external recipe
  });

  useEffect(() => {
    const fetchRecipe = async () => {
      // If we have a recipeId, use backend data (skip external API)
      if (recipeId) {
        setLoading(backendLoading);
        return;
      }

      // Otherwise fetch from external source
      if (!externalSource || !externalId) {
        setError('Recipe not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Select API service based on external source
        if (externalSource === 'SPOONACULAR') {
          const data = await spoonacularService.getRecipeInformation({
            id: Number(externalId),
            includeNutrition: true,
          });
          setExternalRecipe(data);
        } else {
          // TODO: Add support for other sources
          // else if (externalSource === 'EDAMAM') { ... }
          // else if (externalSource === 'TASTY') { ... }
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

  // Determine which recipe to display
  const isBackendRecipe = !!recipeId && !!backendRecipe;

  const handleSaveRecipe = async () => {
    if (!externalRecipe || !externalSource || !externalId) return;

    setSaving(true);

    try {
      // Map external recipe ingredients to RecipeIngredientInput format
      // Note: Currently only Spoonacular format is supported
      const ingredients =
        externalRecipe.extendedIngredients?.map(ing => ({
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

      // Extract instructions in JSON format
      const instructions =
        externalRecipe.analyzedInstructions?.[0]?.steps?.map(step => ({
          number: step.number,
          step: step.step,
        })) || [];

      // Call SaveRecipe mutation with multi-source support
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

      // Update button state to show recipe is saved
      setRecipeSaved(true);
    } catch (err: any) {
      console.error('Failed to save recipe:', err);
      toastService.error('Failed to save recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handler for adding single ingredient (works for both backend and external recipes)
  const handleAddSingleIngredient = useCallback(
    async (ingredient: any) => {
      const defaultShoppingList = getDefaultShoppingList();
      if (!defaultShoppingList) {
        toastService.error('Please create a shopping list first.');
        return;
      }

      try {
        if (isBackendRecipe) {
          // Backend recipe ingredient - use addRecipeIngredientToShoppingList
          await addRecipeIngredientMutation({
            variables: {
              recipeIngredientId: ingredient.id,
              shoppingListId: defaultShoppingList.id,
            },
          });
        } else {
          // External recipe ingredient - use addItemToShoppingList
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
                shoppingListId: defaultShoppingList.id,
                aisle: ingredient.aisle || '',
              },
            },
          });
        }

        // Mark ingredient as added with visual feedback (checkmark icon)
        setAddedIngredients(prev => new Set(prev).add(ingredient.id));
      } catch (error) {
        console.error('Failed to add ingredient:', error);
        toastService.error('Failed to add ingredient to shopping list.');
      }
    },
    [
      isBackendRecipe,
      getDefaultShoppingList,
      addItemToShoppingListMutation,
      addRecipeIngredientMutation,
      setAddedIngredients,
    ],
  );

  // Handler for adding all ingredients (works for both backend and external recipes)
  const handleAddAllIngredientsToList = useCallback(async () => {
    const defaultShoppingList = getDefaultShoppingList();
    if (!defaultShoppingList) {
      toastService.error('Please create a shopping list first.');
      return;
    }

    setAddingToList(true);

    try {
      if (isBackendRecipe && backendRecipe && recipeId) {
        // Backend recipe - use addRecipeToShoppingList mutation
        const result = await addRecipeToShoppingListMutation({
          variables: {
            recipeId,
            shoppingListId: defaultShoppingList.id,
            servings: backendRecipe.servings,
          },
        });

        const data = result.data?.createShoppingListItemsFromRecipe;
        if (data) {
          // Mark all ingredients as added for visual feedback (checkmarks)
          const allIngredientIds = backendRecipe.ingredients.map(ing => ing.id);
          setAddedIngredients(prev => {
            const next = new Set(prev);
            allIngredientIds.forEach(id => next.add(id));
            return next;
          });
        }
      } else if (externalRecipe?.extendedIngredients) {
        // External recipe - add each ingredient individually
        const successfullyAddedIds: number[] = [];

        for (const ingredient of externalRecipe.extendedIngredients) {
          try {
            await addItemToShoppingListMutation({
              variables: {
                input: {
                  itemName:
                    ingredient.name ||
                    ingredient.original ||
                    'Unknown ingredient',
                  quantity: ingredient.amount || 0,
                  unitName:
                    ingredient.measures?.us?.unitShort ||
                    ingredient.measures?.metric?.unitShort ||
                    '',
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

        // Mark successfully added ingredients for visual feedback (checkmarks)
        setAddedIngredients(prev => {
          const next = new Set(prev);
          successfullyAddedIds.forEach(id => next.add(id));
          return next;
        });
      } else {
        toastService.error('No ingredients available to add.');
      }
    } catch (error) {
      console.error('Failed to add ingredients:', error);
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
    setAddedIngredients,
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
    } catch (error) {
      console.error('Failed to add ingredients:', error);
      toastService.error('Failed to add ingredients to shopping list.');
    } finally {
      setAddingToList(false);
    }
  }, [
    backendRecipe,
    recipeId,
    getDefaultShoppingList,
    addRecipeToShoppingListMutation,
  ]);

  const openIngredientSelector = useCallback(() => {
    shoppingListOptionsRef.current?.dismiss();
    // Small delay to allow the first sheet to close
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

      // Add each selected ingredient
      for (const ingredientId of selectedIngredients) {
        const result = await addRecipeIngredientMutation({
          variables: {
            recipeIngredientId: ingredientId,
            shoppingListId: defaultShoppingList.id,
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
        `Added ${addedCount} new items, updated ${updatedCount} existing items`,
      );
      setSelectedIngredients(new Set());
    } catch (error) {
      console.error('Failed to add selected ingredients:', error);
      toastService.error('Failed to add ingredients to shopping list.');
    } finally {
      setAddingToList(false);
    }
  }, [
    backendRecipe,
    recipeId,
    selectedIngredients,
    getDefaultShoppingList,
    addRecipeIngredientMutation,
  ]);

  // Normalize recipe data
  const displayData = useMemo(() => {
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
        vegetarian: externalRecipe.vegetarian,
        vegan: externalRecipe.vegan,
        glutenFree: externalRecipe.glutenFree,
        dairyFree: externalRecipe.dairyFree,
        sourceName: externalRecipe.sourceName,
      };
    }
    return null;
  }, [isBackendRecipe, backendRecipe, externalRecipe]);

  if (loading || backendLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading recipe...</Text>
      </View>
    );
  }

  if (error || backendError || !displayData) {
    const errorMessage =
      error ||
      backendError?.message ||
      (recipeId && !backendRecipe
        ? 'Recipe not found in database'
        : 'Recipe not found');

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        {backendError && (
          <Text style={styles.errorDetails}>
            {JSON.stringify(backendError, null, 2)}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Recipe Image with Back Button */}
        {displayData.image && (
          <View style={styles.imageContainer}>
            <Animated.Image
              source={{ uri: displayData.image }}
              style={[styles.recipeImage, imageAnimatedStyle]}
            />
            {/* Back Button */}
            <TouchableOpacity onPress={goBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1d1d1d" />
            </TouchableOpacity>
          </View>
        )}

        {/* Recipe Title */}
        <View style={styles.content}>
          <Text style={styles.title}>{displayData.title}</Text>

          {/* Recipe Metadata */}
          <View style={styles.metadata}>
            {displayData.servings != null && (
              <Text style={styles.metadataText}>
                🍽️ {displayData.servings} servings
              </Text>
            )}
            {displayData.readyInMinutes != null && (
              <Text style={styles.metadataText}>
                ⏱️ {displayData.readyInMinutes} min
              </Text>
            )}
            {displayData.healthScore != null && !isNaN(displayData.healthScore) && (
              <Text style={styles.metadataText}>
                💚 {Math.round(displayData.healthScore)}% healthy
              </Text>
            )}
          </View>

          {/* Dietary Tags (Only for external recipes) */}
          {!isBackendRecipe && (
            <View style={styles.tags}>
              {displayData.vegetarian && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Vegetarian</Text>
                </View>
              )}
              {displayData.vegan && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Vegan</Text>
                </View>
              )}
              {displayData.glutenFree && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Gluten Free</Text>
                </View>
              )}
              {displayData.dairyFree && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Dairy Free</Text>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {displayData.summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>
                {typeof displayData.summary === 'string'
                  ? displayData.summary.replace(/<[^>]*>/g, '')
                  : displayData.summary}
              </Text>
            </View>
          )}

          {/* Ingredients */}
          {displayData.ingredients && displayData.ingredients.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <TouchableOpacity
                  onPress={handleAddAllIngredientsToList}
                  disabled={addingToList}
                >
                  <Text style={styles.addAllButton}>
                    {addingToList ? 'Adding...' : 'Add All to List'}
                  </Text>
                </TouchableOpacity>
              </View>
              {displayData.ingredients.map((ingredient: any, index: number) => {
                const ingredientText =
                  ingredient.original ||
                  `${ingredient.quantity || ''} ${
                    ingredient.unit?.symbol || ''
                  } ${ingredient.name || ''}`.trim() ||
                  ingredient.originalString ||
                  'Unknown ingredient';
                const isAdded = addedIngredients.has(ingredient.id);

                return (
                  <View key={index} style={styles.ingredientRow}>
                    <Text style={styles.ingredientText}>
                      • {ingredientText}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleAddSingleIngredient(ingredient)}
                      style={styles.addIngredientButton}
                      disabled={isAdded}
                    >
                      <Ionicons
                        name={
                          isAdded ? 'checkmark-circle' : 'add-circle-outline'
                        }
                        size={24}
                        color={
                          isAdded
                            ? theme.colors.success || '#10B981'
                            : theme.colors.primary
                        }
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* Instructions */}
          {displayData.instructions &&
            (isBackendRecipe
              ? Array.isArray(displayData.instructions) &&
                displayData.instructions.length > 0
              : Array.isArray(displayData.instructions) &&
                displayData.instructions.length > 0 &&
                displayData.instructions[0]?.steps?.length > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Instructions</Text>
                {isBackendRecipe
                  ? // Backend recipe instructions (JSON format)
                    displayData.instructions.map((step: any, index: number) => (
                      <View key={index} style={styles.instructionStep}>
                        <Text style={styles.stepNumber}>
                          {step.number || index + 1}.
                        </Text>
                        <Text style={styles.stepText}>{step.step}</Text>
                      </View>
                    ))
                  : // External recipe instructions
                    displayData.instructions[0].steps.map(
                      (step: any, index: number) => (
                        <View key={index} style={styles.instructionStep}>
                          <Text style={styles.stepNumber}>{step.number}.</Text>
                          <Text style={styles.stepText}>{step.step}</Text>
                        </View>
                      ),
                    )}
              </View>
            )}

          {/* Source Attribution (Only for external recipes) */}
          {displayData.sourceName && (
            <View style={styles.attribution}>
              <Text style={styles.attributionText}>
                Recipe from {displayData.sourceName}
              </Text>
            </View>
          )}

          {/* Extra padding for floating button (only for external recipes) */}
          {!isBackendRecipe && <View style={{ height: 140 }} />}
        </View>
      </Animated.ScrollView>

      {/* Floating Action Button - Only for external recipes */}
      {!isBackendRecipe && (
        <View style={styles.floatingButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, recipeSaved && styles.savedButton]}
            onPress={handleSaveRecipe}
            disabled={saving || recipeSaved}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {recipeSaved ? 'Saved ✓' : 'Save to My Recipes'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Shopping List Options Bottom Sheet */}
      <BottomSheetAction
        sheetRef={shoppingListOptionsRef}
        sheetTitle="Add to Shopping List"
        snapPoints={['30%']}
      >
        <View style={styles.shoppingListOptions}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
            ]}
            onPress={handleAddAllIngredients}
          >
            <Ionicons name="list" size={24} color={theme.colors.primary} />
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Add All Ingredients</Text>
              <Text style={styles.optionDescription}>
                Add all recipe ingredients to your shopping list
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={openIngredientSelector}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={24}
              color={theme.colors.primary}
            />
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Select Ingredients</Text>
              <Text style={styles.optionDescription}>
                Choose specific ingredients to add
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </BottomSheetAction>

      {/* Ingredient Selector Bottom Sheet */}
      <BottomSheetAction
        sheetRef={ingredientSelectorRef}
        sheetTitle="Select Ingredients"
        snapPoints={['50%', '75%', '90%']}
      >
        <FlatList
          data={backendRecipe?.ingredients || []}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedIngredients.has(item.id);
            return (
              <TouchableOpacity
                style={styles.ingredientItem}
                onPress={() => toggleIngredient(item.id)}
              >
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={
                    isSelected
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />
                <View style={styles.ingredientInfo}>
                  <Text style={styles.ingredientName}>{item.name}</Text>
                  <Text style={styles.ingredientAmount}>
                    {item.quantity ?? ''} {item.unit?.symbol || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No ingredients available</Text>
          }
        />

        <TouchableOpacity
          style={[
            styles.addSelectedButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleAddSelectedIngredients}
          disabled={selectedIngredients.size === 0 || addingToList}
        >
          {addingToList ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addSelectedButtonText}>
              Add {selectedIngredients.size} ingredient
              {selectedIngredients.size !== 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      </BottomSheetAction>
    </View>
  );
};

// PERFORMANCE: Screen-level error boundary prevents full app reset on mutation failures
export const RecipeDetail: React.FC = () => (
  <RecipeDetailErrorBoundary>
    <RecipeDetailScreen />
  </RecipeDetailErrorBoundary>
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.error,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    fontFamily: 'monospace',
    textAlign: 'left',
  },
  recipeImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  content: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
  },
  title: {
    fontSize: theme.fonts.size['2xl'],
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  metadata: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  metadataText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  tag: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  tagText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  addAllButton: {
    fontSize: theme.fonts.size.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  description: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  ingredientText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    lineHeight: 24,
    flex: 1,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  addIngredientButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  stepNumber: {
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
    color: theme.colors.primary,
    minWidth: 24,
  },
  stepText: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
  attribution: {
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xl,
  },
  attributionText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  savedButton: {
    backgroundColor: theme.colors.success || '#10B981',
    opacity: 0.8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
  shoppingListOptions: {
    padding: theme.spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  optionDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  ingredientAmount: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.size.md,
    marginTop: theme.spacing.xl,
  },
  addSelectedButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  addSelectedButtonText: {
    color: '#fff',
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
  // Image container for back button positioning
  imageContainer: {
    position: 'relative',
  },
  // Back button positioned over image
  backButton: {
    position: 'absolute',
    top: 48,
    left: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
}));
