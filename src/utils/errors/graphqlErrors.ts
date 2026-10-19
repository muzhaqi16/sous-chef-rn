import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { isRecord } from '#/utils/isRecord';
import { describeValue } from '#/utils/errorSerialization';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

/** A write that never reached a verdict, told apart from a generic Error. */
export class GraphQLNetworkError extends Error {
  override readonly name = 'GraphQLNetworkError';

  constructor(fallbackMessage: string) {
    super(fallbackMessage);
  }
}

export interface TopLevelGraphQLError {
  code: string;
  message: string;
  /** The refused argument path (`input.email`) of a value no resolver saw. */
  field: string | null;
  /** The API's fault class; `infrastructure` is a store it could not reach. */
  category: string | null;
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
  if (!first) return null;
  const field = first.extensions?.field;
  const category = first.extensions?.category;
  return {
    code: describeValue(first.extensions?.code ?? ''),
    message: first.message,
    field: typeof field === 'string' && field ? field : null,
    category: typeof category === 'string' ? category : null,
  };
}

/** What a response refused before execution says about itself. */
export interface RefusalEnvelope {
  code: string;
  /** Seconds the server asks the caller to wait; null when it states none. */
  retryAfter: number | null;
}

const positiveSeconds = (value: unknown): number | null => {
  const seconds = typeof value === 'string' ? Number(value) : value;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? seconds
    : null;
};

/**
 * The envelope of a response refused before execution (rate limit, timeout,
 * oversized body). The API sends it non-2xx as `application/json`, which Apollo
 * leaves unparsed, so it arrives as a `ServerError` holding the envelope as TEXT.
 */
export function refusalEnvelopeOf(error: unknown): RefusalEnvelope | null {
  if (!ServerError.is(error)) return null;
  let body: unknown;
  try {
    body = JSON.parse(error.bodyText);
  } catch {
    return null;
  }
  const errors = isRecord(body) ? body.errors : undefined;
  const first: unknown = Array.isArray(errors) ? errors[0] : undefined;
  const extensions = isRecord(first) ? first.extensions : undefined;
  if (!isRecord(extensions) || typeof extensions.code !== 'string') {
    return null;
  }
  return {
    code: extensions.code,
    retryAfter:
      positiveSeconds(extensions.retryAfter) ??
      positiveSeconds(error.response.headers.get('retry-after')),
  };
}

// The codes a read is refused with; HOME_NOT_A_MEMBER answers a caller who left
// the home. A MISSING record is not here: a by-id query reports it as null
// data, and RESOURCE_NOT_FOUND is the mutation spelling.
const RESOURCE_ACCESS_LOST_CODES = new Set<string>([
  ErrorCode.Forbidden,
  TopLevelErrorCode.HomeNotAMember,
]);

/** True when a query error means access was revoked: the row exists but is not
 *  the caller's, which is what separates it from a miss (null data). Network
 *  errors return false, so an offline device does not evict cached data. */
export function isResourceAccessLostError(error: unknown): boolean {
  const top = getTopLevelGraphQLError(error);
  return top !== null && RESOURCE_ACCESS_LOST_CODES.has(top.code);
}

/**
 * Keyed on the code plus the cursor the caller SENT, never the message: the API
 * refuses every pagination argument with VALIDATION_FAILED and no field, so one
 * bounded restart caps it.
 */
export function isDeadCursorError(error: unknown, cursor: unknown): boolean {
  if (cursor == null || cursor === '') return false;
  const top = getTopLevelGraphQLError(error);
  return top?.code === TopLevelErrorCode.ValidationFailed;
}
