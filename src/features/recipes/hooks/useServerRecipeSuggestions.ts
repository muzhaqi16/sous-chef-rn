import { useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { executeRefreshWithFinally } from '#/utils/finallyHelpers';
import { useToday } from '#hooks/app/useToday';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import {
  heldFetchPolicy,
  type StandDownOptions,
} from '#hooks/apollo/standDownOptions';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import { RecipeSuggestionsDocument } from './useServerRecipeSuggestions.generated';

/** The server ranks one page; there is no later one to ask for. */
const SUGGESTION_COUNT = 20;

/**
 * The server's suggestions from what the household holds, screened by its
 * dietary profile, in its order. Not `enabled`, it asks for nothing.
 */
export function useServerRecipeSuggestions(
  enabled: boolean,
  { fetchPolicy }: Pick<StandDownOptions, 'fetchPolicy'> = {},
) {
  const today = useToday();
  const { data, loading, error, refetch } = useQuery(
    RecipeSuggestionsDocument,
    enabled
      ? {
          variables: { first: SUGGESTION_COUNT, today },
          ...heldFetchPolicy(fetchPolicy),
        }
      : skipToken,
  );
  // A failed ask answers `undefined`: the day's last answer stands until a new one.
  const edges = usePreservedQueryData(
    data?.recipeSuggestions.edges,
    undefined,
    today,
  );
  // Set by `refresh` only: a resync refetches the same page unseen.
  const [refreshing, setRefreshing] = useState(false);

  return {
    rows: (edges ?? []).map(
      (edge): RecipeRow => ({ source: 'suggestion', edge }),
    ),
    loading: enabled && loading && !data,
    refreshing: enabled && refreshing,
    /** It answered with nothing, or could not answer: someone else may fill in. */
    unanswered: enabled && (edges?.length === 0 || (!!error && !edges)),
    refresh: async () => {
      if (!enabled) return;
      await executeRefreshWithFinally(refetch, setRefreshing);
    },
  };
}
