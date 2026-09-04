/**
 * `unwrapPayload()` throws these rather than a generic Error, so callers and
 * error boundaries can tell a transport failure (GraphQLNetworkError) from a
 * server-rejected domain error (GraphQLDomainError).
 */

import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

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

// FORBIDDEN is the single authorization code, on both channels. A MISSING record
// is deliberately not here: a by-id query reports a miss as null data, and
// RESOURCE_NOT_FOUND is the mutation spelling of that same condition.
const RESOURCE_ACCESS_LOST_CODES = new Set<string>([ErrorCode.Forbidden]);

/** True when a query error means access was revoked: the row exists but is not
 *  the caller's, which is what separates it from a miss (null data). Network
 *  errors return false, so an offline device does not evict cached data. */
export function isResourceAccessLostError(error: unknown): boolean {
  const top = getTopLevelGraphQLError(error);
  return top !== null && RESOURCE_ACCESS_LOST_CODES.has(top.code);
}

/**
 * True when the server refused a page request's CURSOR. Keyed on the code plus
 * a cursor variable, never the message: the refusal is a bare `ValidationError`
 * told apart only by English prose, and `after` can be wrong about nothing else.
 */
export function isDeadCursorError(
  error: unknown,
  variables: Record<string, unknown> | undefined,
): boolean {
  const cursor = variables?.after ?? variables?.cursor;
  if (cursor == null || cursor === '') return false;
  const top = getTopLevelGraphQLError(error);
  return top?.code === TopLevelErrorCode.ValidationFailed;
}
