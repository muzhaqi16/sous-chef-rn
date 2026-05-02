import { useQuery } from '@apollo/client/react';
import { MySavedRecipesDocument } from '../../graphql/operations/recipe/recipe.generated';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useConnectionData } from '#hooks/utils/useConnectionData';
import type { HookReturn } from '#hooks/types';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Normalized saved recipe with recipe data flattened
 */
export interface SavedRecipe {
  id: string;
  recipeId: string;
  name: string;
  imageUrl?: string | null;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  cuisine?: string | null;
  // Saved recipe metadata
  folder?: string | null;
  tags: string[];
  notes?: string | null;
  personalRating?: number | null;
  cookedCount: number;
  lastCookedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SavedRecipesState {
  recipes: SavedRecipe[];
  loading: boolean;
  error: Error | undefined;
  totalCount: number | undefined;
  hasMore: boolean;
}

interface SavedRecipesActions {
  refetch: () => void;
  loadMore: () => Promise<void>;
  getRecipeById: (recipeId: string) => SavedRecipe | undefined;
  getRecipesByFolder: (folderName: string) => SavedRecipe[];
  getRecipesByTag: (tag: string) => SavedRecipe[];
}

type UseSavedRecipesResult = HookReturn<SavedRecipesState, SavedRecipesActions>;

/** Flatten a saved recipe node into the normalized SavedRecipe shape */
function normalizeSavedRecipe(savedRecipe: {
  id: string;
  recipe: {
    id: string;
    name: string;
    imageUrl?: string | null;
    servings?: number | null;
    prepTimeMinutes?: number | null;
    cookTimeMinutes?: number | null;
    totalTimeMinutes?: number | null;
    description?: string | null;
    category?: string | null;
    difficulty?: string | null;
    cuisine?: string | null;
  };
  folder?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  personalRating?: number | null;
  cookedCount?: number | null;
  lastCookedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}): SavedRecipe {
  return {
    id: savedRecipe.id,
    recipeId: savedRecipe.recipe.id,
    name: savedRecipe.recipe.name,
    imageUrl: savedRecipe.recipe.imageUrl,
    servings: savedRecipe.recipe.servings,
    prepTimeMinutes: savedRecipe.recipe.prepTimeMinutes,
    cookTimeMinutes: savedRecipe.recipe.cookTimeMinutes,
    totalTimeMinutes: savedRecipe.recipe.totalTimeMinutes,
    description: savedRecipe.recipe.description,
    category: savedRecipe.recipe.category,
    difficulty: savedRecipe.recipe.difficulty,
    cuisine: savedRecipe.recipe.cuisine,
    folder: savedRecipe.folder,
    tags: savedRecipe.tags ?? [],
    notes: savedRecipe.notes,
    personalRating: savedRecipe.personalRating,
    cookedCount: savedRecipe.cookedCount ?? 0,
    lastCookedAt: savedRecipe.lastCookedAt,
    createdAt: savedRecipe.createdAt,
    updatedAt: savedRecipe.updatedAt,
  };
}

/**
 * Hook to fetch user's saved/favorited recipes
 * Uses MySavedRecipes query which returns recipes saved via FavoriteRecipe mutation
 */
export function useSavedRecipes(folder?: string | null): UseSavedRecipesResult {
  const isLoggedOut = useIsLoggedOut();

  const { data, loading, error, refetch, fetchMore } = useQuery(
    MySavedRecipesDocument,
    {
      variables: {
        folder: folder ?? undefined,
        first: DEFAULT_PAGE_SIZE,
      },
      skip: isLoggedOut,
    },
  );

  useApolloErrorLogger('MySavedRecipes', error);

  const connectionData = useConnectionData({
    data,
    selector: d => d.me?.savedRecipesConnection,
    loading,
    fetchMore,
  });

  // Flatten saved recipe nodes into normalized shape
  const recipes = connectionData.items.map(normalizeSavedRecipe);

  return {
    state: {
      recipes,
      loading,
      error: error as Error | undefined,
      totalCount: connectionData.totalCount,
      hasMore: connectionData.hasMore,
    },
    actions: {
      refetch,
      loadMore: connectionData.loadMore,
      getRecipeById: (recipeId: string) =>
        recipes.find(recipe => recipe.recipeId === recipeId),
      getRecipesByFolder: (folderName: string) =>
        recipes.filter(recipe => recipe.folder === folderName),
      getRecipesByTag: (tag: string) =>
        recipes.filter(recipe => recipe.tags.includes(tag)),
    },
  };
}
