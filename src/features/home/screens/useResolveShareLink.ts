import { skipToken, useQuery } from '@apollo/client/react';
import { ResolveShareLinkDocument } from '#operations/home/home.generated';

/**
 * Identify what a `join/:code` link points at. `resolveShareLink` is
 * `@optionalAuth`, so this works while logged out.
 */
export function useResolveShareLink(code: string) {
  const { data, loading } = useQuery(
    ResolveShareLinkDocument,
    code ? { variables: { code }, refetchOn: false } : skipToken,
  );

  return { link: data?.resolveShareLink ?? null, loading };
}
