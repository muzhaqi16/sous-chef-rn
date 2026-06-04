/**
 * Typed error classes for GraphQL mutation payload discrimination.
 *
 * unwrapPayload() throws these instead of generic Error so callers and
 * error boundaries can distinguish transport failures (GraphQLNetworkError)
 * from server-rejected domain errors (GraphQLDomainError).
 */

import { CombinedGraphQLErrors } from '@apollo/client/errors';

export class GraphQLDomainError extends Error {
  override readonly name = 'GraphQLDomainError';
  readonly __typename: string;
  readonly code: string;
  readonly payload: Record<string, unknown>;

  constructor(payload: {
    __typename: string;
    code: string;
    message: string;
    [k: string]: unknown;
  }) {
    super(payload.message);
    this.__typename = payload.__typename;
    this.code = payload.code;
    this.payload = payload;
  }
}

export class GraphQLNetworkError extends Error {
  override readonly name = 'GraphQLNetworkError';

  constructor(fallbackMessage: string) {
    super(fallbackMessage);
  }
}

export interface TopLevelGraphQLError {
  code: string;
  message: string;
}

/** Reads the first top-level GraphQL error's code + message from an Apollo
 *  mutation/query `result.error` (Apollo 4 `CombinedGraphQLErrors`). Returns
 *  null when the error isn't a GraphQL error (e.g. a network error). */
export function getTopLevelGraphQLError(
  error: unknown,
): TopLevelGraphQLError | null {
  if (!CombinedGraphQLErrors.is(error) || error.errors.length === 0) {
    return null;
  }
  const first = error.errors[0];
  return {
    code: String(first.extensions?.code ?? ''),
    message: String(first.message ?? ''),
  };
}

// Codes the API returns when a read can no longer reach the resource:
// AUTHZ_FORBIDDEN — access revoked (e.g. a collaborator on a list that became
// home-linked; collaborators are ignored on home-linked lists). FORBIDDEN —
// legacy alias still emitted by some resolvers. RESOURCE_NOT_FOUND — the entity
// was deleted/unshared. In all three cases the client should stop showing the
// (now stale, cache-only) entity rather than preserve it.
const RESOURCE_ACCESS_LOST_CODES = new Set([
  'AUTHZ_FORBIDDEN',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
]);

/** True when a query error means the requesting user can no longer read the
 *  resource — access was revoked, or it was deleted/unshared. Network and other
 *  errors return false, so callers won't evict cached data merely because the
 *  device went offline. */
export function isResourceAccessLostError(error: unknown): boolean {
  const top = getTopLevelGraphQLError(error);
  return top !== null && RESOURCE_ACCESS_LOST_CODES.has(top.code);
}
