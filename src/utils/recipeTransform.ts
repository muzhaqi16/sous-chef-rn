import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/recipeApi/types';

export type DietTag = 'vegan' | 'vegetarian' | 'glutenFree' | 'dairyFree';

export interface TransformedRecipeItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant: 'info';
  };
  imageUrl?: string;
  spoonacularId: number;
  readyInMinutes?: number;
  servings?: number;
  healthScore?: number;
  dietTags?: DietTag[];
}

/**
 * Transforms a Spoonacular recipe result into a display item for lists
 * Optimized for performance - handles both ingredient-based and text-based search results
 *
 * @param recipe - Either a RecipeSearchResult (ingredient search) or SearchRecipesResult (text search)
 * @returns TransformedRecipeItem with unified display properties
 */
export function transformRecipeForDisplay(
  recipe: SearchRecipesResult | RecipeSearchResult,
): TransformedRecipeItem {
  const subtitleParts: string[] = [];
  let badge: { text: string; variant: 'info' } | undefined;

  // Early type detection - check if this is ingredient-based search
  const isIngredientSearch = 'usedIngredientCount' in recipe;

  if (isIngredientSearch) {
    // RecipeSearchResult - ingredient-based search
    const ingredientRecipe = recipe as RecipeSearchResult;
    const totalIngredients =
      ingredientRecipe.usedIngredientCount +
      ingredientRecipe.missedIngredientCount;

    subtitleParts.push(
      `${ingredientRecipe.usedIngredientCount}/${totalIngredients} ingredients`,
    );

    // Badge for ingredient search
    if (ingredientRecipe.likes && ingredientRecipe.likes > 0) {
      badge = {
        text: `❤️ ${ingredientRecipe.likes}`,
        variant: 'info',
      };
    }
  } else {
    // SearchRecipesResult - text-based search
    const textRecipe = recipe as SearchRecipesResult;

    if (textRecipe.readyInMinutes) {
      subtitleParts.push(`⏱ ${textRecipe.readyInMinutes} min`);
    }

    if (textRecipe.servings) {
      subtitleParts.push(`${textRecipe.servings} servings`);
    }

    // Badge for text search
    if (textRecipe.aggregateLikes && textRecipe.aggregateLikes > 0) {
      badge = {
        text: `❤️ ${textRecipe.aggregateLikes}`,
        variant: 'info',
      };
    }

    // Collect diet tags
    const dietTags: DietTag[] = [];
    if (textRecipe.vegan) dietTags.push('vegan');
    else if (textRecipe.vegetarian) dietTags.push('vegetarian');
    if (textRecipe.glutenFree) dietTags.push('glutenFree');
    if (textRecipe.dairyFree) dietTags.push('dairyFree');

    return {
      id: `spoonacular-${recipe.id}`,
      title: recipe.title,
      subtitle: subtitleParts.join(' • '),
      badge,
      imageUrl: recipe.image,
      spoonacularId: recipe.id,
      readyInMinutes: textRecipe.readyInMinutes,
      servings: textRecipe.servings,
      healthScore: textRecipe.healthScore,
      dietTags: dietTags.length > 0 ? dietTags : undefined,
    };
  }

  return {
    id: `spoonacular-${recipe.id}`,
    title: recipe.title,
    subtitle: subtitleParts.join(' • '),
    badge,
    imageUrl: recipe.image,
    spoonacularId: recipe.id,
  };
}
