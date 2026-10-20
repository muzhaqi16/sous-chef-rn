import type { SearchRecipesQuery } from '#features/recipes/hooks/useRecipeSearch.generated';
import type {
  CatalogRecipesByIngredientsQuery,
  RandomCatalogRecipesQuery,
} from '#features/recipes/hooks/useCatalogDiscovery.generated';
import type { RecipeSuggestionsQuery } from '#features/recipes/hooks/useServerRecipeSuggestions.generated';

type FoundNode = SearchRecipesQuery['findRecipes']['edges'][number]['node'];

/** A recipe the API holds, as search lists it. */
export type FoundRecipe = Extract<FoundNode, { __typename: 'Recipe' }>;

/** A catalog recipe the API does not hold yet, as search lists it. */
export type FoundHit = Extract<FoundNode, { __typename: 'CatalogRecipeHit' }>;

/** A catalog recipe that uses some of the ingredients asked about. */
export type IngredientMatchEdge =
  CatalogRecipesByIngredientsQuery['catalogRecipesByIngredients']['edges'][number];

export type RandomHit =
  RandomCatalogRecipesQuery['randomCatalogRecipes']['edges'][number]['node'];

export type RecipeSuggestionEdge =
  RecipeSuggestionsQuery['recipeSuggestions']['edges'][number];

/**
 * A search result or suggestion as it is kept: the row a source returned, with
 * no copy written. The list writes its copy when it renders, so it reads in the
 * language it is shown in, not the one it was fetched in.
 */
export type RecipeRow =
  | { source: 'recipe'; recipe: FoundRecipe }
  | { source: 'catalog'; hit: FoundHit }
  /** What the pantry, or the ingredients picked, can make. */
  | { source: 'pantry'; edge: IngredientMatchEdge }
  /** A suggestion for an empty pantry. */
  | { source: 'random'; hit: RandomHit }
  /** The server's suggestion from what the household holds. */
  | { source: 'suggestion'; edge: RecipeSuggestionEdge };

export const foundRow = (node: FoundNode): RecipeRow =>
  node.__typename === 'Recipe'
    ? { source: 'recipe', recipe: node }
    : { source: 'catalog', hit: node };
