import type {
  Cuisine,
  RecipeStatus,
  Difficulty,
  RecipeCategory,
  Diet,
  HealthGoal,
  Intolerance,
} from '#/graphql/generated/schemaTypes';

export interface IngredientFormState {
  id: string; // local temp id
  name: string;
  quantity: number;
  unitId?: string | null;
  itemId?: string | null;
  preparation?: string;
  section?: string;
  notes?: string;
  isOptional: boolean;
  sortOrder: number;
}

export interface StepFormState {
  id: string; // local temp id
  instruction: string;
  sortOrder: number;
}

export interface RecipeFormState {
  // Basic
  name: string;
  description: string;
  imageUrl: string;
  videoUrl: string;
  servings: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  caloriesPerServing: string;
  // Category
  difficulty: Difficulty | null;
  category: RecipeCategory | null;
  cuisines: Cuisine[];
  status: RecipeStatus;
  // Tags
  diets: Diet[];
  healthGoals: HealthGoal[];
  intolerances: Intolerance[];
  // Nested
  ingredients: IngredientFormState[];
  steps: StepFormState[];
  // Meta
  notes: string;
  tips: string;
  originalAuthor: string;
  // Comma-separated recipe tags (freeform), split into a string[] on save.
  tags: string;
  // The version the form loaded; null for a new recipe.
  version: number | null;
  // The recipe is over the ingredient limit, so the form loaded only the first
  // page of its ingredients, which a save would replace the whole list with;
  // false for a new recipe.
  ingredientsUnread: boolean;
}
