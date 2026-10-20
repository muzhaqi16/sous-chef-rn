import { skipToken, useQuery } from '@apollo/client/react';
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
  const { data, loading } = useQuery(
    CatalogRecipesForItemDocument,
    itemName
      ? {
          variables: { ingredients: [itemName], first: SUGGESTION_COUNT },
          fetchPolicy: 'cache-first',
          refetchOn: false,
        }
      : skipToken,
  );
  // A skipped query keeps the last item's suggestions; with no item, none.
  const edges = itemName ? data?.catalogRecipesByIngredients.edges : undefined;

  return {
    suggestedRecipes: (edges ?? []).map(edge => edge.node),
    loadingRecipes: !!itemName && loading && !data,
  };
}
