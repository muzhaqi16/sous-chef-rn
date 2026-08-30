/**
 * Recipe local-first cache writers (pure functions — no React state, so they
 * live outside the screen component and are independently testable).
 *
 * A local-first create writes BOTH:
 *  - the MyRecipes list edge (so the recipe shows in the list), and
 *  - the full `useRecipeData_recipe` entity (so the complete-gated detail
 *    screen renders offline — `Query.recipe` redirects to it by id).
 *
 * Ingredient `item`/`unit` links are nullable, so offline ingredients carry
 * name + quantity and their links resolve from the server response on sync.
 */

import { type ApolloCache } from '@apollo/client';
import {
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  UseRecipeData_RecipeFragmentDoc,
  type UseRecipeData_RecipeFragment,
} from '#features/recipes/hooks/useRecipeData.generated';
import { RecipeCacheWriters_FormFieldsFragmentDoc } from './recipeCacheWriters.generated';
import { NEUTRAL_RECIPE_FORM_FIELDS } from './recipeFormFieldsNeutral.generated';
import {
  Difficulty,
  RecipeCategory,
  RecipeStatus,
  type CreateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import { generateEntityId } from '#/utils/generateEntityId';

/** The (unmasked) MyRecipes edge node shape the list reads per row. */
export type MyRecipesEdgeNode = {
  __typename: 'Recipe';
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  category: RecipeCategory;
  difficulty: Difficulty;
  savedDetails: {
    __typename: 'SavedRecipe';
    id: string;
    folder: string | null;
  } | null;
};

/**
 * The created-by identity a recipe entity is materialized with. `email` is
 * nullable to match the schema — the API withholds `User.email` from callers
 * other than the user themselves, so a cached `Recipe.createdBy` read back for
 * someone else's recipe carries null there.
 */
export type RecipeCreatedBy = {
  __typename: 'User';
  id: string;
  email: string | null;
} | null;

function totalTime(prep: number | null, cook: number | null): number | null {
  return prep != null || cook != null ? (prep ?? 0) + (cook ?? 0) : null;
}

/** The MyRecipes edge node a local-first create materializes. */
function buildOptimisticRecipeNode(
  id: string,
  input: CreateRecipeInput,
): MyRecipesEdgeNode {
  const prep = input.timing?.prepTimeMinutes ?? null;
  const cook = input.timing?.cookTimeMinutes ?? null;
  return {
    __typename: 'Recipe',
    id,
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.media?.imageUrl ?? null,
    servings: input.metadata?.servings ?? 4,
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: totalTime(prep, cook),
    // The list node selects these non-null; mirror the server-side defaults
    // when the form leaves them unset.
    category: input.metadata?.category ?? RecipeCategory.MainCourse,
    difficulty: input.metadata?.difficulty ?? Difficulty.Easy,
    savedDetails: null,
  };
}

/**
 * Materialize the full Recipe entity the detail screen reads
 * (`useRecipeData_recipe`). The list edge alone isn't enough: the detail screen
 * is complete-gated, so an offline-created recipe would blank without this.
 * Ratings start zeroed, `savedDetails` is null, and ingredient ids are
 * client-minted (replaced by real ids when the create replays).
 */
function buildOptimisticRecipeEntity(
  id: string,
  input: CreateRecipeInput,
  createdBy: RecipeCreatedBy,
): UseRecipeData_RecipeFragment {
  const prep = input.timing?.prepTimeMinutes ?? null;
  const cook = input.timing?.cookTimeMinutes ?? null;
  return {
    __typename: 'Recipe',
    id,
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.media?.imageUrl ?? null,
    servings: input.metadata?.servings ?? 4,
    totalTimeMinutes: totalTime(prep, cook),
    caloriesPerServing: input.nutrition?.caloriesPerServing ?? null,
    nutritionData: (input.nutrition?.nutritionData as JsonValue) ?? null,
    status: input.status ?? RecipeStatus.Draft,
    isPublished: input.status === RecipeStatus.Published,
    publishedAt: null,
    forkedFromId: null,
    forkedFrom: null,
    originalAuthor: input.attribution?.originalAuthor ?? null,
    tips: input.tips ?? null,
    videoUrl: null,
    tags: input.tags ?? [],
    source: null,
    sourceUrl: null,
    // The create input's JSON (write type) is the same runtime instructions
    // array the detail reads back as JsonValue.
    instructions: input.instructions as JsonValue,
    savedDetails: null,
    averageRating: null,
    totalReviews: 0,
    rating1Count: 0,
    rating2Count: 0,
    rating3Count: 0,
    rating4Count: 0,
    rating5Count: 0,
    createdBy,
    ingredientsConnection: {
      __typename: 'RecipeIngredientConnection',
      edges: (input.ingredients ?? []).map((ing, index) => ({
        __typename: 'RecipeIngredientEdge',
        node: {
          __typename: 'RecipeIngredient',
          id: generateEntityId(),
          name: ing.name,
          quantity: ing.quantity,
          estimatedPrice: ing.estimatedPrice ?? null,
          item: null,
          unit: null,
          image: null,
          isOptional: ing.isOptional ?? false,
          notes: ing.notes ?? null,
          preparation: ing.preparation ?? null,
          sortOrder: ing.sortOrder ?? index,
          section: ing.section ?? null,
        },
      })),
    },
  };
}

/**
 * Write the form-only half of the entity. Overlaps deliberately with the
 * MyRecipes edge node (`prepTimeMinutes` … `category`) so the entity satisfies
 * `RecipeForm_recipe` on its own, independent of the edge write.
 */
function writeOptimisticRecipeFormFields(
  cache: ApolloCache,
  id: string,
  input: CreateRecipeInput,
): void {
  const prep = input.timing?.prepTimeMinutes ?? null;
  const cook = input.timing?.cookTimeMinutes ?? null;
  cache.writeFragment({
    id: cache.identify({ __typename: 'Recipe', id }),
    fragment: RecipeCacheWriters_FormFieldsFragmentDoc,
    fragmentName: 'recipeCacheWriters_formFields',
    data: {
      // Neutral base derived from the SDL (see
      // scripts/generate-optimistic-fillers.mjs), so a field added to
      // `RecipeForm_recipe` cannot be forgotten here — that omission is
      // invisible until the detail screen blanks offline.
      ...NEUTRAL_RECIPE_FORM_FIELDS,
      id,
      prepTimeMinutes: prep,
      cookTimeMinutes: cook,
      // The derived base supplies the same server-side defaults the list node
      // mirrors; the form overrides them whenever it has a value.
      difficulty:
        input.metadata?.difficulty ?? NEUTRAL_RECIPE_FORM_FIELDS.difficulty,
      category: input.metadata?.category ?? NEUTRAL_RECIPE_FORM_FIELDS.category,
      cuisine: input.metadata?.cuisine ?? null,
      diets: input.dietary?.diets ?? [],
      healthGoals: input.dietary?.healthGoals ?? [],
      intolerances: input.dietary?.intolerances ?? [],
      notes: input.notes ?? null,
    },
  });
}

/**
 * Insert-or-replace a recipe edge in MyRecipes. Shared by the local-first
 * pre-fire write (insert) and the mutation's update callback (replace — the
 * server row carries the same client-minted id, so the optimistic node is
 * upgraded in place instead of duplicated).
 */
export function upsertMyRecipesEdge(
  cache: ApolloCache,
  node: MyRecipesEdgeNode,
): void {
  cache.updateQuery<MyRecipesQuery>({ query: MyRecipesDocument }, existing => {
    if (!existing?.recipes) return existing;
    const present = existing.recipes.edges.some(
      edge => edge.node.id === node.id,
    );
    return {
      ...existing,
      recipes: {
        ...existing.recipes,
        edges: present
          ? existing.recipes.edges.map(edge =>
              edge.node.id === node.id ? { ...edge, node } : edge,
            )
          : [
              { __typename: 'RecipeEdge', cursor: node.id, node },
              ...existing.recipes.edges,
            ],
        totalCount: present
          ? existing.recipes.totalCount
          : (existing.recipes.totalCount ?? 0) + 1,
      },
    };
  });
}

/** Remove a recipe edge from MyRecipes. */
function removeMyRecipesEdge(cache: ApolloCache, id: string): void {
  cache.updateQuery<MyRecipesQuery>({ query: MyRecipesDocument }, existing => {
    if (!existing?.recipes) return existing;
    const present = existing.recipes.edges.some(edge => edge.node.id === id);
    if (!present) return existing;
    return {
      ...existing,
      recipes: {
        ...existing.recipes,
        edges: existing.recipes.edges.filter(edge => edge.node.id !== id),
        totalCount: (existing.recipes.totalCount ?? 0) - 1,
      },
    };
  });
}

/**
 * Local-first create write: the MyRecipes edge + the full detail entity, under
 * the same client-minted id.
 */
export function writeOptimisticRecipe(
  cache: ApolloCache,
  id: string,
  input: CreateRecipeInput,
  createdBy: RecipeCreatedBy,
): void {
  upsertMyRecipesEdge(cache, buildOptimisticRecipeNode(id, input));
  cache.writeFragment({
    id: cache.identify({ __typename: 'Recipe', id }),
    fragment: UseRecipeData_RecipeFragmentDoc,
    fragmentName: 'useRecipeData_recipe',
    data: buildOptimisticRecipeEntity(id, input, createdBy),
  });
  // GetRecipe = useRecipeData_recipe + RecipeForm_recipe; without this the read
  // is incomplete and the detail screen is blank offline.
  writeOptimisticRecipeFormFields(cache, id, input);
}

/** Revert a rejected create: drop the edge and evict the entity. */
export function revertOptimisticRecipe(cache: ApolloCache, id: string): void {
  removeMyRecipesEdge(cache, id);
  cache.evict({ id: cache.identify({ __typename: 'Recipe', id }) });
  cache.gc();
}
