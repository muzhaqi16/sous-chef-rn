/**
 * Spoonacular API Types
 * Reference: https://spoonacular.com/food-api/docs
 */

// ============================================
// Search Recipes by Ingredients
// ============================================

export interface SpoonacularIngredient {
  id: number;
  name: string;
  image: string;
}

export interface SearchRecipesByIngredientsParams {
  ingredients: string; // Comma-separated list of ingredients
  number?: number; // Number of results (default: 10, max: 100)
  ranking?: 1 | 2; // 1 = maximize used ingredients, 2 = minimize missing ingredients
  ignorePantry?: boolean; // Ignore typical pantry items
}

export interface RecipeSearchResult {
  id: number;
  title: string;
  image: string;
  imageType: string;
  usedIngredientCount: number;
  missedIngredientCount: number;
  missedIngredients: SpoonacularIngredient[];
  usedIngredients: SpoonacularIngredient[];
  unusedIngredients: SpoonacularIngredient[];
  likes: number;
}

// ============================================
// Get Recipe Information
// ============================================

export interface GetRecipeInformationParams {
  id: number;
  includeNutrition?: boolean;
}

export interface RecipeNutrient {
  name: string;
  amount: number;
  unit: string;
  percentOfDailyNeeds: number;
}

export interface RecipeNutrition {
  nutrients: RecipeNutrient[];
  properties: RecipeNutrient[];
  flavonoids: RecipeNutrient[];
  ingredients: Array<{
    id: number;
    name: string;
    amount: number;
    unit: string;
    nutrients: RecipeNutrient[];
  }>;
  caloricBreakdown: {
    percentProtein: number;
    percentFat: number;
    percentCarbs: number;
  };
  weightPerServing: {
    amount: number;
    unit: string;
  };
}

export interface RecipeIngredientMeasure {
  amount: number;
  unitShort: string;
  unitLong: string;
}

export interface RecipeIngredient {
  id: number;
  aisle: string;
  image: string;
  consistency: string;
  name: string;
  nameClean: string;
  original: string;
  originalName: string;
  amount: number;
  unit: string;
  meta: string[];
  measures: {
    us: RecipeIngredientMeasure;
    metric: RecipeIngredientMeasure;
  };
}

export interface RecipeInstructionStep {
  number: number;
  step: string;
  ingredients: Array<{
    id: number;
    name: string;
    localizedName: string;
    image: string;
  }>;
  equipment: Array<{
    id: number;
    name: string;
    localizedName: string;
    image: string;
  }>;
  length?: {
    number: number;
    unit: string;
  };
}

export interface RecipeInstruction {
  name: string;
  steps: RecipeInstructionStep[];
}

export interface WineProductMatch {
  id: number;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  averageRating: number;
  ratingCount: number;
  score: number;
  link: string;
}

export interface RecipeInformation {
  id: number;
  title: string;
  image: string;
  imageType: string;
  servings: number;
  readyInMinutes: number;
  preparationMinutes: number;
  cookingMinutes: number;
  license: string;
  sourceName: string;
  sourceUrl: string;
  spoonacularSourceUrl: string;
  healthScore: number;
  spoonacularScore: number;
  pricePerServing: number;
  analyzedInstructions: RecipeInstruction[];
  cheap: boolean;
  creditsText: string;
  cuisines: string[];
  dairyFree: boolean;
  diets: string[];
  gaps: string;
  glutenFree: boolean;
  instructions: string;
  ketogenic: boolean;
  lowFodmap: boolean;
  occasions: string[];
  sustainable: boolean;
  vegan: boolean;
  vegetarian: boolean;
  veryHealthy: boolean;
  veryPopular: boolean;
  whole30: boolean;
  weightWatcherSmartPoints: number;
  dishTypes: string[];
  extendedIngredients: RecipeIngredient[];
  summary: string;
  winePairing?: {
    pairedWines: string[];
    pairingText: string;
    productMatches: WineProductMatch[];
  };
  nutrition?: RecipeNutrition;
}

// ============================================
// Search Recipes (Complex Search)
// ============================================

export interface SearchRecipesParams {
  query: string;
  cuisine?: string;
  diet?: string;
  intolerances?: string;
  equipment?: string;
  includeIngredients?: string;
  excludeIngredients?: string;
  type?: string;
  instructionsRequired?: boolean;
  fillIngredients?: boolean;
  addRecipeInformation?: boolean;
  addRecipeNutrition?: boolean;
  maxReadyTime?: number;
  number?: number;
  offset?: number;
  sort?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface SearchRecipesResult {
  id: number;
  title: string;
  image: string;
  imageType: string;
  // Additional fields when addRecipeInformation: true
  servings?: number;
  readyInMinutes?: number;
  aggregateLikes?: number;
  healthScore?: number;
  pricePerServing?: number;
  cheap?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
}

export interface SearchRecipesResponse {
  results: SearchRecipesResult[];
  offset: number;
  number: number;
  totalResults: number;
}

/**
 * When `addRecipeInformation: true` is passed to `searchRecipes`, the
 * Spoonacular API returns full `RecipeInformation` objects in `results[]`
 * (extendedIngredients, analyzedInstructions, summary, nutrition, …) instead
 * of the lean `SearchRecipesResult` shape.
 */
export interface SearchRecipesResponseWithInfo {
  results: RecipeInformation[];
  offset: number;
  number: number;
  totalResults: number;
}

export interface SearchRecipesParamsWithoutInfo
  extends Omit<SearchRecipesParams, 'addRecipeInformation'> {
  addRecipeInformation?: false;
}

export interface SearchRecipesParamsWithInfo
  extends Omit<SearchRecipesParams, 'addRecipeInformation'> {
  addRecipeInformation: true;
}

// ============================================
// Get Random Recipes
// ============================================

export interface GetRandomRecipesParams {
  number?: number; // Number of random recipes (default: 1, max: 100)
  tags?: string; // Comma-separated list of tags (e.g., 'vegetarian,dessert')
  includeNutrition?: boolean;
}

export interface GetRandomRecipesResponse {
  recipes: RecipeInformation[];
}

// ============================================
// Error Types
// ============================================

export interface SpoonacularError {
  status: string;
  code: number;
  message: string;
}

export interface SpoonacularApiError extends Error {
  status?: number;
  code?: number;
  isRateLimitError?: boolean;
  isQuotaExceeded?: boolean;
}
