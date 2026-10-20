import { skipToken, useApolloClient, useQuery } from '@apollo/client/react';
import { catalogIngredientNames } from '#domain/catalogRecipes';
import { useFirstFetchPolicy } from '#hooks/apollo/useFirstFetchPolicy';
import {
  CatalogRecipesForItemDocument,
  type CatalogRecipesForItemQuery,
} from './useRecipeSuggestionsForItem.generated';

const SUGGESTION_COUNT = 5;

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
  const client = useApolloClient();
  // Empty for a name the API would refuse, which leaves nothing to ask about.
  const ingredients = catalogIngredientNames(itemName ? [itemName] : []);
  const asked = ingredients.length > 0;
  const variables = { ingredients, first: SUGGESTION_COUNT };
  const fetchPolicy = useFirstFetchPolicy(
    asked ? JSON.stringify(variables) : null,
    () =>
      client.readQuery({ query: CatalogRecipesForItemDocument, variables })
        ?.catalogRecipesByIngredients.catalogAvailable === false,
  );
  const { data, loading } = useQuery(
    CatalogRecipesForItemDocument,
    asked ? { variables, fetchPolicy, refetchOn: false } : skipToken,
  );
  // A skipped query keeps the last item's suggestions; with nothing asked, none.
  const edges = asked ? data?.catalogRecipesByIngredients.edges : undefined;

  return {
    suggestedRecipes: (edges ?? []).map(edge => edge.node),
    loadingRecipes: asked && loading && !data,
  };
}
