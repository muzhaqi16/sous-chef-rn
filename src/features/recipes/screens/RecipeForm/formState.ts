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
  /** Null when the recipe states no amount ("salt, to taste"). */
  quantity: number | null;
  unitId?: string | null;
  /** The unit as shown; the form holds only its id otherwise. */
  unitLabel?: string;
  /** The line as written, from a capture or a paste; sent back on save. */
  originalText?: string | null;
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

/** The publisher or site a capture named, and the link it read. */
export interface CapturedFrom {
  source: string | null;
  sourceUrl: string | null;
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
  // Where a capture read the recipe: sent with a create, and no field shows it.
  capturedFrom: CapturedFrom | null;
  // Comma-separated recipe tags (freeform), split into a string[] on save.
  tags: string;
  // The version the form loaded; null for a new recipe.
  version: number | null;
  // The recipe is over the ingredient limit, so the form loaded only the first
  // page of its ingredients, which a save would replace the whole list with;
  // false for a new recipe.
  ingredientsUnread: boolean;
}
