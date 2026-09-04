import type {
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
  servings: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  caloriesPerServing: string;
  // Category
  difficulty: Difficulty | null;
  category: RecipeCategory | null;
  cuisine: string;
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
}
