import { useQuery } from '@apollo/client/react';
import { RecommendedRecipeDocument } from './useRecommendedRecipe.generated';

/**
 * A recommended recipe as it is now: undefined until it is read (or while it
 * cannot be), null once it is gone.
 */
export function useRecommendedRecipe(id: string) {
  const { data } = useQuery(RecommendedRecipeDocument, { variables: { id } });
  return data?.recipe;
}
