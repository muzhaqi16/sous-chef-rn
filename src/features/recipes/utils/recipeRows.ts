import type {
  RecipeInformation,
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/spoonacular/types';
import type { SearchRecipesQuery } from '#features/recipes/graphql/recipe.generated';
import type { RecipeSuggestionsQuery } from '#features/recipes/hooks/useServerRecipeSuggestions.generated';
import type { ExternalSource } from '#/graphql/generated/schemaTypes';

export type LocalRecipeNode =
  SearchRecipesQuery['searchRecipes']['edges'][number]['node'];

/** What search reads off an API recipe to page and dedupe it, whatever else its card selects. */
export interface SearchedRecipe {
  id: string;
  name: string;
  externalSource?: ExternalSource | null;
  externalId?: string | null;
}

export type SpoonacularRecipe = SearchRecipesResult | RecipeSearchResult;

export type RecipeSuggestionEdge =
  RecipeSuggestionsQuery['recipeSuggestions']['edges'][number];

/**
 * A search result or suggestion as it is kept: the row a source returned, with
 * no copy written. The list writes its copy when it renders, so it reads in the
 * language it is shown in, not the one it was fetched in.
 */
export type RecipeRow<TNode extends SearchedRecipe = LocalRecipeNode> =
  | { source: 'spoonacular'; recipe: SpoonacularRecipe }
  | {
      source: 'local';
      node: TNode;
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

export const spoonacularRows = <TNode extends SearchedRecipe>(
  results: readonly SpoonacularRecipe[],
): RecipeRow<TNode>[] =>
  results.map(
    (recipe): RecipeRow<TNode> => ({ source: 'spoonacular', recipe }),
  );

/**
 * Imported recipes carry no time or likes, so `enrichmentFor` lends each row
 * the live Spoonacular values.
 */
export const localRows = <TNode extends SearchedRecipe>(
  nodes: readonly TNode[],
  enrichmentFor: (node: TNode) => SpoonacularRecipe | undefined,
): RecipeRow<TNode>[] =>
  nodes.map(
    (node): RecipeRow<TNode> => ({
      source: 'local',
      node,
      match: enrichmentFor(node),
    }),
  );
