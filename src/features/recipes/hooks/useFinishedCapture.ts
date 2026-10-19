import { skipToken, useQuery } from '@apollo/client/react';
import { RecipeCaptureDocument } from './useRecipeCapture.generated';

/** A capture that ended, read once, since it does not change. Null until read. */
export function useFinishedCapture(captureId: string | null | undefined) {
  const { data } = useQuery(
    RecipeCaptureDocument,
    captureId
      ? {
          variables: { id: captureId },
          fetchPolicy: 'cache-first',
          refetchOn: false,
        }
      : skipToken,
  );
  return data?.recipeCapture ?? null;
}
