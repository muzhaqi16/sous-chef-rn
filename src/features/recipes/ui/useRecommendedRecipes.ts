import { skipToken, useQuery } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import type { RecommendedRecipeCard_RecipeFragmentDoc } from './RecommendedRecipeCard.generated';
import { RecommendedRecipeDocument } from './useRecommendedRecipes.generated';

/** The API recommends at most three (`RECOMMENDATIONS_SHOWN` in its summaries). */
export const RECOMMENDED_RECIPES_SHOWN = 3;

export interface RecommendedRecipeReading {
  /** As its card shows it; undefined until read, or when the read failed. */
  recipe:
    | FragmentType<typeof RecommendedRecipeCard_RecipeFragmentDoc>
    | undefined;
  /** The API answered that it does not exist: deleted or unpublished since. */
  gone: boolean;
}

// `errorPolicy: 'none'` keeps a failed read's `null` out of the cache, where an
// offline read would take it for a recipe that is gone. Each recipe is its own
// read, so its error is its own.
const useReading = (id: string | undefined): RecommendedRecipeReading => {
  const { data, error } = useQuery(
    RecommendedRecipeDocument,
    id
      ? { variables: { id }, errorPolicy: 'none', refetchOn: false }
      : skipToken,
  );
  return {
    recipe: data?.recipe ?? undefined,
    gone: data?.recipe === null && !error,
  };
};

/** The recipes a notification recommends, as they are now, in its order. */
export function useRecommendedRecipes(
  ids: readonly string[],
): RecommendedRecipeReading[] {
  const [first, second, third] = ids;
  const readings = [useReading(first), useReading(second), useReading(third)];
  return readings.slice(0, Math.min(ids.length, RECOMMENDED_RECIPES_SHOWN));
}
