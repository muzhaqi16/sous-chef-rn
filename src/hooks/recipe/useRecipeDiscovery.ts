import { useState, useEffect } from 'react';

import { useDefaultHome } from '#hooks/home/useDefaultHome';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import { useDietaryProfile } from '#hooks/profile/useDietaryProfile';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type {
  RecipeSearchResult,
  RecipeInformation,
} from '#/services/recipeApi/types';
import { useGetHomeQuery } from '#generated';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

export type DiscoveryMode = 'pantry' | 'random' | 'none';

export interface DiscoveryItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  imageUrl?: string;
  spoonacularId: number;
}

// No params needed — discovery always shows regardless of saved recipe state

interface UseRecipeDiscoveryResult {
  mode: DiscoveryMode;
  items: DiscoveryItem[];
  loading: boolean;
  refresh: () => void;
  pantryItems: any[];
  hasPantryItems: boolean;
  pantryHasMore: boolean;
  pantryLoadingMore: boolean;
  loadMorePantryItems: () => void;
}

/** Transforms a RecipeInformation (random recipe) into a DiscoveryItem */
function transformRandomRecipe(recipe: RecipeInformation): DiscoveryItem {
  const subtitleParts: string[] = [];
  if (recipe.servings) {
    subtitleParts.push(`${recipe.servings} servings`);
  }
  const totalTime =
    recipe.readyInMinutes || recipe.preparationMinutes || recipe.cookingMinutes;
  if (totalTime) {
    subtitleParts.push(`${totalTime} min`);
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle: subtitleParts.join(' \u2022 '),
    badge: { text: 'Suggested' },
    imageUrl: recipe.image,
    spoonacularId: recipe.id,
  };
}

/** Transforms a pantry search result into a DiscoveryItem */
function transformPantryResult(recipe: RecipeSearchResult): DiscoveryItem {
  const totalIngredients =
    recipe.usedIngredientCount + recipe.missedIngredientCount;

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle: `${recipe.usedIngredientCount}/${totalIngredients} ingredients`,
    badge:
      recipe.likes && recipe.likes > 0
        ? {
            text: `${recipe.usedIngredientCount}/${totalIngredients} match`,
            variant: 'primary',
          }
        : { text: 'From Pantry' },
    imageUrl: recipe.image,
    spoonacularId: recipe.id,
  };
}

/** Module-level helper: fetch pantry-based recipes */
async function fetchPantryDiscovery(
  ingredientNames: string,
  setItems: (v: DiscoveryItem[]) => void,
  setMode: (v: DiscoveryMode) => void,
  setLoading: (v: boolean) => void,
  signal?: AbortSignal,
): Promise<void> {
  await executeWithLoadingState(
    async () => {
      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientNames,
        number: 10,
        ranking: 1,
        ignorePantry: true,
      });
      if (signal?.aborted) return;
      setItems(results.map(transformPantryResult));
      setMode('pantry');
    },
    setLoading,
    (error: unknown) => {
      if ((error as any).name === 'AbortError') return;
      console.error('Failed to fetch pantry-based recipes:', error);
    },
  );
}

/** Module-level helper: fetch random recipes */
async function fetchRandomDiscovery(
  setItems: (v: DiscoveryItem[]) => void,
  setMode: (v: DiscoveryMode) => void,
  setLoading: (v: boolean) => void,
  signal?: AbortSignal,
  dietaryTags?: string,
): Promise<void> {
  await executeWithLoadingState(
    async () => {
      const results = await spoonacularService.getRandomRecipes(
        { number: 10, tags: dietaryTags },
        signal,
      );
      if (signal?.aborted) return;
      setItems(results.map(transformRandomRecipe));
      setMode('random');
    },
    setLoading,
    (error: unknown) => {
      if ((error as any).name === 'AbortError') return;
      console.error('Failed to fetch random recipes:', error);
    },
  );
}

/**
 * Manages recipe discovery for new users who have no saved recipes.
 * Prefers pantry-based ingredient search if user has pantry items,
 * falls back to random recipe suggestions otherwise.
 */
export function useRecipeDiscovery(): UseRecipeDiscoveryResult {
  const {
    state: { selectedHomeId },
    actions: { getDefaultPantry },
  } = useDefaultHome();

  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  const defaultPantry = getDefaultPantry(homeData);
  const {
    state: {
      items: pantryItems,
      loading: pantryLoading,
      hasMore: pantryHasMore,
      isLoadingMore: pantryLoadingMore,
    },
    actions: { loadMore: loadMorePantryItems },
  } = usePantryManagement(defaultPantry?.id);

  const hasPantryItems = (pantryItems?.length ?? 0) > 0;

  // Dietary profile — used as tags for random recipe discovery
  const { profile: dietaryProfile } = useDietaryProfile();
  const dietaryTags = (() => {
    const tags: string[] = [];
    const dietRestriction = dietaryProfile?.restrictions?.find(
      (r: any) => r.diet,
    );
    if (dietRestriction?.diet) {
      tags.push(dietRestriction.diet.toLowerCase());
    }
    return tags.length > 0 ? tags.join(',') : undefined;
  })();

  const [discoveryItems, setDiscoveryItems] = useState<DiscoveryItem[]>([]);
  const [mode, setMode] = useState<DiscoveryMode>('none');
  const [loading, setLoading] = useState(true);

  // Fetch-key pattern: compute a stable key that changes when we should re-fetch.
  // This avoids putting `loading` in useEffect deps (which causes an abort cycle).
  const [fetchKey, setFetchKey] = useState('');

  const shouldFetch = !pantryLoading;

  const currentKey = shouldFetch ? `fetch|${pantryItems?.length ?? 0}` : '';

  // Adjusting state during render: trigger fetch when conditions are met and key changed
  if (currentKey && currentKey !== fetchKey) {
    setFetchKey(currentKey);
  }

  // Effect depends only on fetchKey — no loading in deps, no eslint-disable needed
  useEffect(() => {
    if (!fetchKey) return;

    const controller = new AbortController();

    const ingredientNames = (pantryItems ?? [])
      .map(item => item.itemName)
      .filter(Boolean)
      .slice(0, 20)
      .join(',');

    if (ingredientNames) {
      fetchPantryDiscovery(
        ingredientNames,
        setDiscoveryItems,
        setMode,
        setLoading,
        controller.signal,
      );
    } else {
      fetchRandomDiscovery(
        setDiscoveryItems,
        setMode,
        setLoading,
        controller.signal,
        dietaryTags,
      );
    }

    return () => controller.abort();
  }, [fetchKey, pantryItems, dietaryTags]);

  // Refresh: re-fetch discovery recipes
  const refresh = () => {
    if (loading) return;

    const ingredientNames = (pantryItems ?? [])
      .map(item => item.itemName)
      .filter(Boolean)
      .slice(0, 20)
      .join(',');

    if (ingredientNames) {
      fetchPantryDiscovery(
        ingredientNames,
        setDiscoveryItems,
        setMode,
        setLoading,
      );
    } else {
      fetchRandomDiscovery(
        setDiscoveryItems,
        setMode,
        setLoading,
        undefined,
        dietaryTags,
      );
    }
  };

  return {
    mode,
    items: discoveryItems,
    loading,
    refresh,
    pantryItems: pantryItems ?? [],
    hasPantryItems,
    pantryHasMore,
    pantryLoadingMore,
    loadMorePantryItems,
  };
}
