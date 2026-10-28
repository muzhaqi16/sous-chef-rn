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
import { useSelectedHomeId } from '#store/useAppStore';
import { RecipeSuggestionsDocument } from './useServerRecipeSuggestions.generated';

/** The server ranks one page; there is no later one to ask for. */
const SUGGESTION_COUNT = 20;

/**
 * The server's suggestions from what the selected home holds (every pantry the
 * user may view when none is selected), screened by its dietary profile, in its
 * order. Not `enabled`, it asks for nothing.
 */
export function useServerRecipeSuggestions(
  enabled: boolean,
  { fetchPolicy }: Pick<StandDownOptions, 'fetchPolicy'> = {},
) {
  const today = useToday();
  const homeId = useSelectedHomeId() ?? undefined;
  const { data, loading, error, refetch } = useQuery(
    RecipeSuggestionsDocument,
    enabled
      ? {
          variables: { first: SUGGESTION_COUNT, today, homeId },
          ...heldFetchPolicy(fetchPolicy),
        }
      : skipToken,
  );
  // A failed ask answers `undefined`: the last answer for this day and home
  // stands until a new one, and never stands in for another home's.
  const edges = usePreservedQueryData(
    data?.recipeSuggestions.edges,
    undefined,
    `${today}:${homeId ?? ''}`,
  );
  // Set by `refresh` only: a resync refetches the same page unseen.
  const [refreshing, setRefreshing] = useState(false);

  return {
    rows: (edges ?? []).map(
      (edge): RecipeRow => ({ source: 'suggestion', edge }),
    ),
    loading: enabled && loading && !data,
    /** Some suggestion uses what the pantry holds; else they are only ideas. */
    fromPantry: (edges ?? []).some(edge => edge.coverage > 0),
    refreshing: enabled && refreshing,
    /** It answered with nothing, or could not answer: someone else may fill in. */
    unanswered: enabled && (edges?.length === 0 || (!!error && !edges)),
    refresh: async () => {
      if (!enabled) return;
      await executeRefreshWithFinally(refetch, setRefreshing);
    },
  };
}
