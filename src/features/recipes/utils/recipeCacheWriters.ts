/**
 * Local-first cache writers for recipes. A create writes the recipe's row —
 * complete for the detail, the form and the list — and its MyRecipes edge.
 * Ingredient `item`/`unit` links are nullable and resolve from the server on sync.
 */

import type { ApolloCache } from '@apollo/client';
import { RecipeCacheWriters_RowFragmentDoc } from './recipeCacheWriters.generated';
import {
  NEUTRAL_LOCAL_RECIPE,
  NEUTRAL_LOCAL_RECIPE_BY_TYPE,
} from './recipeRowNeutral.generated';
import {
  RecipeStatus,
  type CreateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  skipUnmatchedFilterVariants,
} from '#/apollo/utils/cacheUpdaters';

const addToMyRecipes = createAddToQueryConnectionUpdater('recipes', 'Recipe');
const removeFromMyRecipes = createRemoveFromQueryConnectionUpdater(
  'recipes',
  'Recipe',
);

/**
 * The created-by identity a recipe is materialized with. `email` is nullable:
 * the API withholds `User.email` from anyone but its owner, so another's cached
 * `Recipe.createdBy` carries null.
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
 * the ingredient ids minted with it; the rest what the create states or neutral.
 */
function writeRecipeRow(
  cache: ApolloCache,
  id: string,
  input: CreateRecipeInput,
  createdBy: RecipeCreatedBy,
  ingredientIds: readonly string[],
): void {
  const prep = input.timing?.prepTimeMinutes ?? null;
  const cook = input.timing?.cookTimeMinutes ?? null;
  const calories = input.nutrition?.caloriesPerServing ?? null;
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
      caloriesPerServing: calories,
      // The server's derivation: calories from `caloriesPerServing` when set.
      nutritionPerServing:
        calories === null ? null : { __typename: 'RecipeNutrition', calories },
      // A create asking to publish is stored in review until a moderator approves.
      status:
        !input.status || input.status === RecipeStatus.Draft
          ? RecipeStatus.Draft
          : RecipeStatus.PendingReview,
      originalAuthor: input.attribution?.originalAuthor ?? null,
      source: input.attribution?.source ?? null,
      sourceUrl: input.attribution?.sourceUrl ?? null,
      tips: input.tips ?? null,
      tags: input.tags ?? [],
      // The create input's JSON is the same runtime instructions array the
      // detail reads back.
      instructions: input.instructions,
      createdBy,
      ingredientsConnection: {
        __typename: 'RecipeIngredientConnection',
        edges: input.ingredients.flatMap((ing, index) => {
          const ingredientId = ingredientIds[index];
          if (!ingredientId) return [];
          return [
            {
              __typename: 'RecipeIngredientEdge',
              node: {
                __typename: 'RecipeIngredient',
                id: ingredientId,
                name: ing.name,
                quantity: ing.quantity ?? null,
                originalText: ing.originalText ?? null,
                estimatedPrice: ing.estimatedPrice ?? null,
                isOptional: ing.isOptional ?? false,
                notes: ing.notes ?? null,
                preparation: ing.preparation ?? null,
                sortOrder: ing.sortOrder ?? index,
                section: ing.section ?? null,
              },
            },
          ];
        }),
        // A create states every ingredient: no page is left to read.
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        totalCount: input.ingredients.length,
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
 * Lists a recipe in the user's recipes, once. Only the unfiltered list: a
 * filtered one's membership is the server's.
 */
export function upsertMyRecipesEdge(
  cache: ApolloCache,
  // The typename makes the cache reference; an id alone adds nothing.
  recipe: { __typename: 'Recipe'; id: string },
): void {
  addToMyRecipes(cache, recipe, {
    skipStoreField: skipUnmatchedFilterVariants({}),
  });
}

/**
 * The server made a recipe this device never wrote (a capture saved it): the
 * cached lists of the user's recipes are dropped, so the next read fetches.
 */
export function forgetMyRecipesLists(cache: ApolloCache): void {
  cache.evict({ id: 'ROOT_QUERY', fieldName: 'recipes' });
  cache.gc();
}

/** Takes a recipe out of every cached list of the user's recipes. */
export function removeMyRecipesEdge(cache: ApolloCache, id: string): void {
  removeFromMyRecipes(cache, id);
}

/** Local-first create write: the recipe's row, then its MyRecipes edge. */
export function writeLocalRecipe(
  cache: ApolloCache,
  id: string,
  input: CreateRecipeInput,
  createdBy: RecipeCreatedBy,
  ingredientIds: readonly string[],
): void {
  writeRecipeRow(cache, id, input, createdBy, ingredientIds);
  upsertMyRecipesEdge(cache, { __typename: 'Recipe', id });
}
