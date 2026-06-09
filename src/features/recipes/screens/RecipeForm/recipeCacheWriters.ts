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

import type { ApolloCache } from '@apollo/client';
import {
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import {
  UseRecipeData_RecipeFragmentDoc,
  type UseRecipeData_RecipeFragment,
} from '#features/recipes/hooks/useRecipeData.generated';
import {
  Difficulty,
  RecipeCategory,
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

/** The created-by identity a recipe entity is materialized with. */
export type RecipeCreatedBy = {
  __typename: 'User';
  id: string;
  email: string;
} | null;

function totalTime(prep: number | null, cook: number | null): number | null {
  return prep != null || cook != null ? (prep ?? 0) + (cook ?? 0) : null;
}

/** The MyRecipes edge node a local-first create materializes. */
function buildOptimisticRecipeNode(
  id: string,
  input: CreateRecipeInput,
): MyRecipesEdgeNode {
  const prep = input.prepTimeMinutes ?? null;
  const cook = input.cookTimeMinutes ?? null;
  return {
    __typename: 'Recipe',
    id,
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    servings: input.servings ?? 4,
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: totalTime(prep, cook),
    // The list node selects these non-null; mirror the server-side defaults
    // when the form leaves them unset.
    category: input.category ?? RecipeCategory.MainCourse,
    difficulty: input.difficulty ?? Difficulty.Easy,
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
  const prep = input.prepTimeMinutes ?? null;
  const cook = input.cookTimeMinutes ?? null;
  return {
    __typename: 'Recipe',
    id,
    name: input.name,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    servings: input.servings ?? 4,
    totalTimeMinutes: totalTime(prep, cook),
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
    ingredients: (input.ingredients ?? []).map((ing, index) => ({
      __typename: 'RecipeIngredient',
      id: generateEntityId(),
      name: ing.name,
      quantity: ing.quantity,
      item: null,
      unit: null,
      image: null,
      isOptional: ing.isOptional ?? false,
      notes: ing.notes ?? null,
      preparation: ing.preparation ?? null,
      sortOrder: ing.sortOrder ?? index,
      section: ing.section ?? null,
    })),
  };
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
}

/** Revert a rejected create: drop the edge and evict the entity. */
export function revertOptimisticRecipe(cache: ApolloCache, id: string): void {
  removeMyRecipesEdge(cache, id);
  cache.evict({ id: cache.identify({ __typename: 'Recipe', id }) });
  cache.gc();
}
