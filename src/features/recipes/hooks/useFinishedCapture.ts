import { skipToken, useQuery } from '@apollo/client/react';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useDataState } from '#hooks/data/useDataState';
import { RecipeCaptureDocument } from './useRecipeCapture.generated';

/** A capture that ended, read once, since it does not change. Null until read. */
export function useFinishedCapture(captureId: string | null | undefined) {
  const { data, loading, error, refetch } = useQuery(
    RecipeCaptureDocument,
    captureId
      ? {
          variables: { id: captureId },
          fetchPolicy: 'cache-first',
          refetchOn: false,
        }
      : skipToken,
  );
  useApolloErrorLogger(RecipeCaptureDocument, error);
  const capture = data?.recipeCapture ?? null;
  const state = useDataState({
    loading,
    error,
    hasResult: !!capture,
    isEmpty: false,
    skipped: !captureId,
  });
  return {
    capture,
    state,
    retry: () => {
      void refetch();
    },
  };
}
