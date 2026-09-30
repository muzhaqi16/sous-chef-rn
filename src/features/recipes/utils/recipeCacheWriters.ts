/**
 * Local-first cache writers for recipes. A create writes the recipe's row —
 * complete for the detail, the form and the list — and its MyRecipes edge.
 * Ingredient `item`/`unit` links are nullable and resolve from the server on sync.
 */

import type { ApolloCache } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import {
  MyRecipesDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { RecipeCacheWriters_RowFragmentDoc } from './recipeCacheWriters.generated';
import {
  NEUTRAL_LOCAL_RECIPE,
  NEUTRAL_LOCAL_RECIPE_BY_TYPE,
} from './recipeRowNeutral.generated';
import {
  RecipeStatus,
  type CreateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import { generateEntityId } from '#/utils/generateEntityId';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';

/** A MyRecipes edge's node, whole. */
type MyRecipesEdgeNode = NonNullable<
  Unmasked<MyRecipesQuery>['recipes']
>['edges'][number]['node'];

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
  displayName: string | null;
} | null;

function totalTime(prep: number | null, cook: number | null): number | null {
  return prep != null || cook != null ? (prep ?? 0) + (cook ?? 0) : null;
}

/**
 * Write the recipe a create makes: ratings zeroed, no reviews, not saved, and
 * client-minted ingredient ids; the rest what the create states or neutral.
 */
function writeRecipeRow(
  cache: ApolloCache,
  id: string,
  input: CreateRecipeInput,
  createdBy: RecipeCreatedBy,
): void {
  const prep = input.timing?.prepTimeMinutes ?? null;
  const cook = input.timing?.cookTimeMinutes ?? null;
  writeLocalEntity(cache, {
    fragment: RecipeCacheWriters_RowFragmentDoc,
    fragmentName: 'recipeCacheWriters_row',
    neutral: NEUTRAL_LOCAL_RECIPE,
    neutralByType: NEUTRAL_LOCAL_RECIPE_BY_TYPE,
    known: {
      __typename: 'Recipe',
      id,
      name: input.name,
      description: input.description ?? null,
      imageUrl: input.media?.imageUrl ?? null,
      videoUrl: input.media?.videoUrl ?? null,
      servings: input.metadata?.servings ?? 4,
      prepTimeMinutes: prep,
      cookTimeMinutes: cook,
      totalTimeMinutes: totalTime(prep, cook),
      difficulty: input.metadata?.difficulty ?? undefined,
      category: input.metadata?.category ?? undefined,
      cuisines: input.metadata?.cuisines ?? [],
      diets: input.dietary?.diets ?? [],
      healthGoals: input.dietary?.healthGoals ?? [],
      intolerances: input.dietary?.intolerances ?? [],
      notes: input.notes ?? null,
      caloriesPerServing: input.nutrition?.caloriesPerServing ?? null,
      nutritionData: input.nutrition?.nutritionData ?? null,
      // A create asking to publish is stored in review until a moderator approves.
      status:
        !input.status || input.status === RecipeStatus.Draft
          ? RecipeStatus.Draft
          : RecipeStatus.PendingReview,
      originalAuthor: input.attribution?.originalAuthor ?? null,
      tips: input.tips ?? null,
      tags: input.tags ?? [],
      // The create input's JSON is the same runtime instructions array the
      // detail reads back.
      instructions: input.instructions,
      createdBy,
      ingredientsConnection: {
        __typename: 'RecipeIngredientConnection',
        edges: input.ingredients.map((ing, index) => ({
          __typename: 'RecipeIngredientEdge',
          node: {
            __typename: 'RecipeIngredient',
            id: generateEntityId(),
            name: ing.name,
            quantity: ing.quantity,
            estimatedPrice: ing.estimatedPrice ?? null,
            isOptional: ing.isOptional ?? false,
            notes: ing.notes ?? null,
            preparation: ing.preparation ?? null,
            sortOrder: ing.sortOrder ?? index,
            section: ing.section ?? null,
          },
        })),
      },
      reviewsConnection: {
        __typename: 'RecipeReviewConnection',
        totalCount: 0,
        edges: [],
      },
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

/** Local-first create write: the recipe's row, then its MyRecipes edge. */
export function writeLocalRecipe(
  cache: ApolloCache,
  id: string,
  input: CreateRecipeInput,
  createdBy: RecipeCreatedBy,
): void {
  writeRecipeRow(cache, id, input, createdBy);
  const row = cache.readFragment({
    id: cache.identify({ __typename: 'Recipe', id }),
    fragment: RecipeCacheWriters_RowFragmentDoc,
    fragmentName: 'recipeCacheWriters_row',
  });
  if (row) upsertMyRecipesEdge(cache, row);
}

/** Revert a rejected create: drop the edge and evict the entity. */
export function revertOptimisticRecipe(cache: ApolloCache, id: string): void {
  removeMyRecipesEdge(cache, id);
  cache.evict({ id: cache.identify({ __typename: 'Recipe', id }) });
  cache.gc();
}
