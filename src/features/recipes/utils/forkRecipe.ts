import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import type {
  CreateRecipeInput,
  Diet,
  Difficulty,
  HealthGoal,
  Intolerance,
  RecipeCategory,
  RecipeIngredientInput,
} from '#/graphql/generated/schemaTypes';

/** One ingredient of the recipe being forked, as `RecipeForm_recipe` caches it. */
export interface ForkableIngredient {
  id: string;
  name: string;
  quantity?: number | null;
  isOptional?: boolean | null;
  notes?: string | null;
  preparation?: string | null;
  section?: string | null;
  sortOrder?: number | null;
  image?: string | null;
  item?: { id: string } | null;
  unit?: { id: string } | null;
}

/** The recipe being forked, as `RecipeForm_recipe` caches it. */
export interface ForkableRecipe {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  caloriesPerServing?: number | null;
  difficulty?: Difficulty | null;
  category?: RecipeCategory | null;
  cuisine?: string | null;
  diets?: Diet[] | null;
  healthGoals?: HealthGoal[] | null;
  intolerances?: Intolerance[] | null;
  notes?: string | null;
  tips?: string | null;
  originalAuthor?: string | null;
  tags?: string[] | null;
  instructions?: unknown;
  ingredients: ForkableIngredient[];
}

/**
 * The fork as a create input: what the device SHOWS while the fork is queued,
 * not what is sent. The server performs the fork and replaces this under the
 * same id.
 */
export function forkRecipe(
  source: ForkableRecipe,
  options: { name: string },
): Omit<CreateRecipeInput, 'id'> {
  return {
    name: options.name,
    // A forked copy starts as the author's draft, as `RecipeService.forkRecipe`
    // creates it.
    status: RecipeStatus.Draft,
    instructions: source.instructions ?? [],
    ingredients: source.ingredients.map(toIngredientInput),
    ...(source.description != null && { description: source.description }),
    ...(source.notes != null && { notes: source.notes }),
    ...(source.tips != null && { tips: source.tips }),
    ...(source.tags != null && { tags: source.tags }),
    metadata: {
      ...(source.category != null && { category: source.category }),
      ...(source.cuisine != null && { cuisine: source.cuisine }),
      ...(source.difficulty != null && { difficulty: source.difficulty }),
      ...(source.servings != null && { servings: source.servings }),
    },
    timing: {
      ...(source.prepTimeMinutes != null && {
        prepTimeMinutes: source.prepTimeMinutes,
      }),
      ...(source.cookTimeMinutes != null && {
        cookTimeMinutes: source.cookTimeMinutes,
      }),
    },
    dietary: {
      diets: source.diets ?? [],
      healthGoals: source.healthGoals ?? [],
      intolerances: source.intolerances ?? [],
    },
    ...(source.caloriesPerServing != null && {
      nutrition: { caloriesPerServing: source.caloriesPerServing },
    }),
    ...(source.imageUrl != null && { media: { imageUrl: source.imageUrl } }),
    ...(source.originalAuthor != null && {
      attribution: { originalAuthor: source.originalAuthor },
    }),
  };
}

const toIngredientInput = (
  ingredient: ForkableIngredient,
): RecipeIngredientInput => ({
  name: ingredient.name,
  quantity: ingredient.quantity ?? 0,
  ...(ingredient.item && { itemId: ingredient.item.id }),
  ...(ingredient.unit && { unitId: ingredient.unit.id }),
  ...(ingredient.isOptional != null && { isOptional: ingredient.isOptional }),
  ...(ingredient.notes != null && { notes: ingredient.notes }),
  ...(ingredient.preparation != null && {
    preparation: ingredient.preparation,
  }),
  ...(ingredient.section != null && { section: ingredient.section }),
  ...(ingredient.sortOrder != null && { sortOrder: ingredient.sortOrder }),
  ...(ingredient.image != null && { image: ingredient.image }),
});
