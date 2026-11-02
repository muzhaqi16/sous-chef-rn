import { skipToken, useQuery } from '@apollo/client/react';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useDataState } from '#hooks/data/useDataState';
import { ResolveShareLinkDocument } from '#operations/home/home.generated';

/**
 * Identify what a `join/:code` link points at. `resolveShareLink` is
 * `@optionalAuth`, so this works while logged out.
 */
export function useResolveShareLink(code: string) {
  const { data, loading, error, refetch } = useQuery(
    ResolveShareLinkDocument,
    code ? { variables: { code }, refetchOn: false } : skipToken,
  );
  // A null link is the server's "no match"; a failed read is `undefined`.
  const held = usePreservedQueryData(data, undefined, code);
  const link = held?.resolveShareLink ?? null;
  const state = useDataState({
    loading,
    error,
    hasResult: held !== undefined,
    isEmpty: !link,
    skipped: !code,
  });

  return { link, loading, state, refetch };
}
