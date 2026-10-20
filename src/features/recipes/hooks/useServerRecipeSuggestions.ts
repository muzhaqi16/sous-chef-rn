import { skipToken, useQuery } from '@apollo/client/react';
import { useToday } from '#hooks/app/useToday';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import { RecipeSuggestionsDocument } from './useServerRecipeSuggestions.generated';

/** The server ranks one page; there is no later one to ask for. */
const SUGGESTION_COUNT = 20;

/**
 * The server's suggestions from what the household holds, screened by its
 * dietary profile, in its order. Not `enabled`, it asks for nothing.
 */
export function useServerRecipeSuggestions(enabled: boolean) {
  const today = useToday();
  const { data, loading, error, refetch } = useQuery(
    RecipeSuggestionsDocument,
    enabled ? { variables: { first: SUGGESTION_COUNT, today } } : skipToken,
  );
  const edges = data?.recipeSuggestions.edges;

  return {
    rows: (edges ?? []).map(
      (edge): RecipeRow => ({ source: 'suggestion', edge }),
    ),
    loading: enabled && loading && !data,
    /** It answered with nothing, or could not answer: someone else may fill in. */
    unanswered: enabled && (edges?.length === 0 || (!!error && !data)),
    refresh: async () => {
      if (!enabled) return;
      await refetch();
    },
  };
}
