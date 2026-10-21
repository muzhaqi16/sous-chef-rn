import { skipToken, useQuery } from '@apollo/client/react';
import { catalogIngredientNames } from '#domain/catalogRecipes';
import { useCatalogReadOptions } from '#features/recipes/hooks/useCatalogReadOptions';
import {
  CatalogRecipesForItemDocument,
  type CatalogRecipesForItemQuery,
} from './useRecipeSuggestionsForItem.generated';

const SUGGESTION_COUNT = 5;
const SUGGESTIONS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ItemRecipeSuggestion =
  CatalogRecipesForItemQuery['catalogRecipesByIngredients']['edges'][number]['node'];

export interface UseRecipeSuggestionsForItemResult {
  suggestedRecipes: ItemRecipeSuggestion[];
  loadingRecipes: boolean;
}

/**
 * Catalog recipes that use a pantry item, by its name. Item names repeat
 * across households, so the API's cache answers most of these.
 */
export function useRecipeSuggestionsForItem(
  itemName: string | undefined,
): UseRecipeSuggestionsForItemResult {
  // Empty for a name the API would refuse, which leaves nothing to ask about.
  const ingredients = catalogIngredientNames(itemName ? [itemName] : []);
  const asked = ingredients.length > 0;
  const variables = asked ? { ingredients, first: SUGGESTION_COUNT } : null;
  const readOptions = useCatalogReadOptions(
    CatalogRecipesForItemDocument,
    variables,
    {
      field: 'catalogRecipesByIngredients',
      maxAgeMs: SUGGESTIONS_MAX_AGE_MS,
      pageOf: data => data.catalogRecipesByIngredients,
    },
  );
  const { data, loading } = useQuery(
    CatalogRecipesForItemDocument,
    variables ? { variables, ...readOptions } : skipToken,
  );
  // A skipped query keeps the last item's suggestions; with nothing asked, none.
  const edges = asked ? data?.catalogRecipesByIngredients.edges : undefined;

  return {
    suggestedRecipes: (edges ?? []).map(edge => edge.node),
    loadingRecipes: asked && loading && !data,
  };
}
