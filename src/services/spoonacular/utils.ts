import type { RecipeInformation, RecipeIngredient } from './types';

/**
 * Transform Spoonacular recipe data to GraphQL CreateRecipeInput format
 */
export const transformSpoonacularToRecipeInput = (
  spoonacularRecipe: RecipeInformation,
) => {
  // Strip HTML tags from summary
  const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, '');
  };

  // Determine dietary tags from boolean flags
  const dietaryTags: string[] = [];
  if (spoonacularRecipe.vegetarian) dietaryTags.push('VEGETARIAN');
  if (spoonacularRecipe.vegan) dietaryTags.push('VEGAN');
  if (spoonacularRecipe.glutenFree) dietaryTags.push('GLUTEN_FREE');
  if (spoonacularRecipe.dairyFree) dietaryTags.push('DAIRY_FREE');
  if (spoonacularRecipe.ketogenic) dietaryTags.push('KETO');
  if (spoonacularRecipe.whole30) dietaryTags.push('WHOLE30');

  // Extract calories from nutrition data
  const caloriesPerServing = spoonacularRecipe.nutrition?.nutrients?.find(
    n => n.name === 'Calories',
  )?.amount;

  // Transform instructions to JSON format
  const instructions = spoonacularRecipe.analyzedInstructions?.[0]?.steps ?? [];

  return {
    name: spoonacularRecipe.title,
    description: stripHtml(spoonacularRecipe.summary || ''),
    servings: spoonacularRecipe.servings,
    prepTimeMinutes: spoonacularRecipe.preparationMinutes || null,
    cookTimeMinutes: spoonacularRecipe.cookingMinutes || null,
    totalTimeMinutes: spoonacularRecipe.readyInMinutes,
    instructions: instructions,
    imageUrl: spoonacularRecipe.image,
    sourceUrl: spoonacularRecipe.sourceUrl,
    source: spoonacularRecipe.sourceName || 'Spoonacular',

    // Spoonacular-specific fields
    spoonacularId: spoonacularRecipe.id,
    spoonacularSourceUrl: spoonacularRecipe.spoonacularSourceUrl,
    spoonacularScore: spoonacularRecipe.spoonacularScore,
    healthScore: spoonacularRecipe.healthScore,
    pricePerServing: spoonacularRecipe.pricePerServing,
    dishTypes: spoonacularRecipe.dishTypes || [],
    creditsText: spoonacularRecipe.creditsText,
    sourceName: spoonacularRecipe.sourceName,
    spoonacularData: spoonacularRecipe, // Cache full response

    status: 'PUBLISHED',

    // Nutrition
    caloriesPerServing: caloriesPerServing
      ? Math.round(caloriesPerServing)
      : null,
    nutritionData: spoonacularRecipe.nutrition ?? null,

    // Tags
    dietaryTags,
    tags: [
      ...(spoonacularRecipe.cuisines || []),
      ...(spoonacularRecipe.dishTypes || []),
    ],
  };
};

/**
 * Get image URL for Spoonacular ingredient
 */
export const getSpoonacularIngredientImageUrl = (imageName: string): string => {
  if (!imageName) return '';
  return `https://spoonacular.com/cdn/ingredients_100x100/${imageName}`;
};

/**
 * Get full image URL for recipe
 */
export const getSpoonacularRecipeImageUrl = (
  recipeId: number,
  size:
    | '90x90'
    | '240x150'
    | '312x231'
    | '480x360'
    | '556x370'
    | '636x393' = '636x393',
): string => {
  return `https://spoonacular.com/recipeImages/${recipeId}-${size}.jpg`;
};

/**
 * Extract pantry items from user's pantry that match recipe ingredients
 */
export const matchPantryItemsToIngredients = (
  recipeIngredients: RecipeIngredient[],
  pantryItems: Array<{ id: string; name: string }>,
): Map<number, string[]> => {
  const matches = new Map<number, string[]>();

  recipeIngredients.forEach(ingredient => {
    const ingredientNameLower = ingredient.name.toLowerCase();
    // Containment BOTH ways on purpose: "tomato" should match a pantry
    // "cherry tomatoes", and "olive oil" an ingredient "oil". Not a user
    // search, so it does not go through the list matcher.
    const matchingPantryItems = pantryItems.filter(pantryItem => {
      const pantryName = pantryItem.name.toLowerCase();
      return (
        ingredientNameLower.includes(pantryName) ||
        pantryName.includes(ingredientNameLower)
      );
    });

    if (matchingPantryItems.length > 0) {
      matches.set(
        ingredient.id,
        matchingPantryItems.map(item => item.id),
      );
    }
  });

  return matches;
};

/**
 * Calculate recipe match percentage based on available pantry items
 */
export const calculateRecipeMatchPercentage = (
  totalIngredients: number,
  matchedIngredients: number,
): number => {
  if (totalIngredients === 0) return 0;
  return Math.round((matchedIngredients / totalIngredients) * 100);
};
