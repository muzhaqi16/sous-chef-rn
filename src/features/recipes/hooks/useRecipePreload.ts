/**
 * Hook for preloading recipe data to the backend
 *
 * When a user views an external recipe (from Spoonacular), this hook will:
 * 1. Store the recipe in the backend via upsertExternalRecipe
 * 2. Return the backend recipe ID for subsequent operations
 * 3. Provide a function to save the recipe to user's favorites
 */

import { useState, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  FavoriteRecipeDocument,
  UpsertExternalRecipeDocument,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import { RecipeInformation } from '#/services/recipeApi/types';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { toastService } from '#/services/toastService';
import { useTranslation } from 'react-i18next';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

/**
 * Represents a recipe that has been preloaded to the backend
 */
export interface PreloadedRecipe {
  /** Backend recipe ID */
  id: string;
  /** Recipe name */
  name: string;
  /** Recipe image URL */
  imageUrl?: string;
  /** Whether this was a newly created recipe (vs found existing) */
  created: boolean;
  /** External source */
  externalSource: ExternalSource;
  /** External ID (Spoonacular ID) */
  externalId: string;
}

export interface UseRecipePreloadOptions {
  /** Callback when preload succeeds */
  onPreloadSuccess?: (recipe: PreloadedRecipe) => void;
  /** Callback when preload fails */
  onPreloadError?: (error: Error) => void;
  /** Callback when favorite succeeds */
  onFavoriteSuccess?: () => void;
  /** Callback when favorite fails */
  onFavoriteError?: (error: Error) => void;
}

export interface SaveToFavoritesOptions {
  /** Folder to save recipe to */
  folder?: string;
  /** Tags to add to the saved recipe */
  tags?: string[];
  /** User notes about the recipe */
  notes?: string;
}

export function useRecipePreload(options: UseRecipePreloadOptions = {}) {
  const { t } = useTranslation();
  const { onPreloadSuccess, onFavoriteSuccess, onFavoriteError } = options;

  // State
  const [preloading, setPreloading] = useState(false);
  const [preloadedRecipe, setPreloadedRecipe] =
    useState<PreloadedRecipe | null>(null);
  const [preloadError, setPreloadError] = useState<string | null>(null);
  const [savingToFavorites, setSavingToFavorites] = useState(false);

  // Cache of preloaded recipes (externalId -> PreloadedRecipe)
  const preloadCacheRef = useRef<Map<string, PreloadedRecipe>>(new Map());

  // Track which recipes we've already attempted to preload (to prevent multiple calls)
  const attemptedPreloadsRef = useRef<Set<string>>(new Set());

  // Mutations
  const [favoriteRecipe] = useMutation(FavoriteRecipeDocument, {
    // Use cache.updateQuery instead of refetchQueries for better performance and offline support
    update: (cache, { data }) => {
      if (data?.favoriteRecipe?.__typename !== 'FavoriteRecipePayload') return;

      const savedRecipe = data.favoriteRecipe.savedRecipe;

      // Add to MySavedRecipes cache
      cache.updateQuery<MySavedRecipesQuery>(
        { query: MySavedRecipesDocument },
        existing => {
          if (!existing?.me) return existing;

          // Check if already exists (prevent duplicates)
          const exists = existing.me.savedRecipesConnection.edges.some(
            edge => edge.node.id === savedRecipe.id,
          );
          if (exists) return existing;

          return {
            ...existing,
            me: {
              ...existing.me,
              savedRecipesConnection: {
                ...existing.me.savedRecipesConnection,
                edges: [
                  ...existing.me.savedRecipesConnection.edges,
                  {
                    __typename: 'SavedRecipeEdge',
                    cursor: savedRecipe.id,
                    node: savedRecipe,
                  },
                ],
                totalCount:
                  (existing.me.savedRecipesConnection.totalCount ?? 0) + 1,
              },
            },
          };
        },
      );

      // Persist optimistic favorite state to survive cache-and-network refetches while offline
      optimisticDataPersistence.save(
        'SavedRecipe',
        savedRecipe.recipe.id,
        'isFavorited',
        true,
      );

      // Update SavedRecipeFolders cache if a folder was specified
      const folder = savedRecipe.folder;
      if (folder) {
        cache.updateQuery<SavedRecipeFoldersQuery>(
          { query: SavedRecipeFoldersDocument },
          existing => {
            if (!existing) return existing;

            // Check if folder already exists
            if (existing.savedRecipeFolders.includes(folder)) {
              return existing;
            }

            // Add the new folder to the list
            return {
              ...existing,
              savedRecipeFolders: [...existing.savedRecipeFolders, folder],
            };
          },
        );
      }
    },
  });
  const [upsertRecipe] = useMutation(UpsertExternalRecipeDocument);

  /**
   * Transform Spoonacular recipe data to CreateRecipeInput format
   */
  const transformToRecipeInput = (spoonacularRecipe: RecipeInformation) => {
    // Extract calories from nutrition data
    const caloriesPerServing = spoonacularRecipe.nutrition?.nutrients?.find(
      n => n.name === 'Calories',
    )?.amount;

    // Transform instructions to JSON format (matches user-created format: { step, text })
    const instructions =
      spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map(step => ({
        step: step.number,
        text: step.step,
      })) || [];

    return {
      // Basic recipe info
      name: spoonacularRecipe.title,
      description: spoonacularRecipe.summary?.replace(/<[^>]*>/g, ''),
      servings: spoonacularRecipe.servings,
      prepTimeMinutes: spoonacularRecipe.preparationMinutes || undefined,
      cookTimeMinutes: spoonacularRecipe.cookingMinutes || undefined,
      imageUrl: spoonacularRecipe.image,
      instructions,
      caloriesPerServing: caloriesPerServing
        ? Math.round(caloriesPerServing)
        : undefined,
      cuisine: spoonacularRecipe.cuisines?.join(', '),

      // Attribution - original recipe source
      attribution: {
        source: spoonacularRecipe.sourceName,
        sourceUrl: spoonacularRecipe.sourceUrl,
      },

      // External source fields
      source: ExternalSource.Spoonacular,
      externalSourceId: String(spoonacularRecipe.id),
      externalSourceUrl: spoonacularRecipe.sourceUrl,
      externalSourceData: spoonacularRecipe,

      // Transform ingredients for backend
      ingredients:
        spoonacularRecipe.extendedIngredients?.map((ing, idx) => ({
          name: ing.name,
          quantity: ing.amount || 0,
          originalString: ing.original,
          spoonacularIngredientId: ing.id,
          aisle: ing.aisle,
          image: ing.image,
          metricAmount: ing.measures?.metric?.amount,
          metricUnit: ing.measures?.metric?.unitShort,
          usAmount: ing.measures?.us?.amount,
          usUnit: ing.measures?.us?.unitShort,
          sortOrder: idx,
        })) || [],
    };
  };

  /**
   * Preload a recipe to the backend (fire-and-forget)
   *
   * This should be called when a user views an external recipe.
   * The recipe will be stored in the backend (find-or-create pattern).
   * This is fire-and-forget - it only attempts once per recipe.
   */
  const preloadRecipe = async (
    spoonacularRecipe: RecipeInformation,
    externalSource: ExternalSource = ExternalSource.Spoonacular,
    preloadOptions: { throwOnError?: boolean } = {},
  ): Promise<PreloadedRecipe | null> => {
    const externalId = String(spoonacularRecipe.id);

    // Only attempt once per recipe (fire-and-forget)
    if (attemptedPreloadsRef.current.has(externalId)) {
      const cached = preloadCacheRef.current.get(externalId);
      return cached || null;
    }
    attemptedPreloadsRef.current.add(externalId);

    setPreloading(true);

    const input = transformToRecipeInput(spoonacularRecipe);

    const result = await executeMutation(
      () => upsertRecipe({ variables: { input } }),
      error => {
        console.error('[preloadRecipe] Error:', error);
        if (preloadOptions.throwOnError) {
          setPreloading(false);
          throw error; // Propagate error for explicit saves
        }
      },
    );

    setPreloading(false);

    if (!result) return null;

    const data = result.data?.upsertExternalRecipe;
    if (data?.recipe) {
      const preloaded: PreloadedRecipe = {
        id: data.recipe.id,
        name: data.recipe.name,
        imageUrl: data.recipe.imageUrl ?? undefined,
        created: data.created,
        externalSource,
        externalId,
      };

      preloadCacheRef.current.set(externalId, preloaded);
      setPreloadedRecipe(preloaded);
      onPreloadSuccess?.(preloaded);

      return preloaded;
    }

    return null;
  };

  /**
   * Save a preloaded recipe to user's favorites
   *
   * If the recipe has been preloaded, this uses favoriteRecipe.
   * If not preloaded yet, this preloads first then favorites it.
   */
  const saveRecipeToFavorites = async (
    spoonacularRecipe: RecipeInformation,
    saveOptions?: SaveToFavoritesOptions,
  ): Promise<{ success: boolean; recipeId?: string }> => {
    setSavingToFavorites(true);

    const externalId = String(spoonacularRecipe.id);
    let cached = preloadCacheRef.current.get(externalId);

    // If not preloaded yet, preload first
    if (!cached || cached.id.startsWith('pending_')) {
      attemptedPreloadsRef.current.delete(externalId);

      const preloaded = await preloadRecipe(
        spoonacularRecipe,
        ExternalSource.Spoonacular,
        { throwOnError: true },
      );
      if (!preloaded) {
        setSavingToFavorites(false);
        toastService.error(t('recipes.saveRecipeFailed'));
        return { success: false };
      }
      cached = preloaded;
    }

    const recipeId = cached.id;

    const result = await executeMutation(
      () =>
        favoriteRecipe({
          variables: {
            input: {
              recipeId,
              folder: saveOptions?.folder,
              tags: saveOptions?.tags,
              notes: saveOptions?.notes,
            },
          },
        }),
      (error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to save recipe to favorites:', errorMessage);
        toastService.error(t('recipes.saveRecipeFailed'));

        if (error instanceof Error) {
          onFavoriteError?.(error);
        }
      },
    );

    setSavingToFavorites(false);

    if (!result) return { success: false };

    // Clear persisted optimistic favorite state on server confirmation
    optimisticDataPersistence.clear('SavedRecipe', recipeId, 'isFavorited');

    toastService.success(t('recipes.recipeSavedToCollection'));
    onFavoriteSuccess?.();

    return { success: true, recipeId };
  };

  /**
   * Check if a recipe is preloaded
   */
  const isPreloaded = (externalId: string): boolean => {
    const cached = preloadCacheRef.current.get(externalId);
    return !!cached && !cached.id.startsWith('pending_');
  };

  /**
   * Get preloaded recipe by external ID
   */
  const getPreloadedRecipe = (
    externalId: string,
  ): PreloadedRecipe | undefined => {
    return preloadCacheRef.current.get(externalId);
  };

  /**
   * Check if a recipe is fully saved (not just pending)
   */
  const isFullySaved = (externalId: string): boolean => {
    const cached = preloadCacheRef.current.get(externalId);
    return !!cached && !cached.id.startsWith('pending_');
  };

  /**
   * Clear the preload cache
   */
  const clearCache = () => {
    preloadCacheRef.current.clear();
    setPreloadedRecipe(null);
    setPreloadError(null);
  };

  return {
    // State
    preloading,
    preloadedRecipe,
    preloadError,
    savingToFavorites,

    // Actions
    preloadRecipe,
    saveRecipeToFavorites,

    // Helpers
    isPreloaded,
    getPreloadedRecipe,
    isFullySaved,
    clearCache,
  };
}

export type UseRecipePreloadReturn = ReturnType<typeof useRecipePreload>;
