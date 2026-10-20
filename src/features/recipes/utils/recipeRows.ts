import type {
  RecipeInformation,
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/spoonacular/types';
import type { SearchRecipesQuery } from '#features/recipes/graphql/recipe.generated';
import type { RecipeSuggestionsQuery } from '#features/recipes/hooks/useServerRecipeSuggestions.generated';

export type LocalRecipeNode =
  SearchRecipesQuery['searchRecipes']['edges'][number]['node'];

export type SpoonacularRecipe = SearchRecipesResult | RecipeSearchResult;

export type RecipeSuggestionEdge =
  RecipeSuggestionsQuery['recipeSuggestions']['edges'][number];

/**
 * A search result or suggestion as it is kept: the row a source returned, with
 * no copy written. The list writes its copy when it renders, so it reads in the
 * language it is shown in, not the one it was fetched in.
 */
export type RecipeRow =
  | { source: 'spoonacular'; recipe: SpoonacularRecipe }
  | {
      source: 'local';
      node: LocalRecipeNode;
      match: SpoonacularRecipe | undefined;
    }
  /** A suggestion for an empty pantry. */
  | { source: 'random'; recipe: RecipeInformation }
  /** A suggestion the pantry can make, with its cook time once enriched. */
  | {
      source: 'pantry';
      recipe: RecipeSearchResult;
      info: RecipeInformation | undefined;
    }
  /** The server's suggestion from what the household holds. */
  | { source: 'suggestion'; edge: RecipeSuggestionEdge };

export const spoonacularRows = (
  results: readonly SpoonacularRecipe[],
): RecipeRow[] =>
  results.map((recipe): RecipeRow => ({ source: 'spoonacular', recipe }));

/**
 * Imported recipes carry no time or likes, so `enrichmentFor` lends each row
 * the live Spoonacular values.
 */
export const localRows = (
  nodes: readonly LocalRecipeNode[],
  enrichmentFor: (node: LocalRecipeNode) => SpoonacularRecipe | undefined,
): RecipeRow[] =>
  nodes.map(
    (node): RecipeRow => ({
      source: 'local',
      node,
      match: enrichmentFor(node),
    }),
  );
