/**
 * The API's page-size refusal. Its query limits (cost, depth, tokens, length,
 * aliases, directives) refuse a document before execution, so a build meets
 * them only by shipping one over a limit; nothing counts fields.
 */

// A TopLevelErrorCode member, repeated literally because a TS string enum
// rejects a computed initializer.
export enum QueryComplexityErrorType {
  PAGINATION_LIMIT_EXCEEDED = 'PAGINATION_LIMIT_EXCEEDED',
}

/**
 * Query complexity error details
 */
export interface QueryComplexityDetails {
  errorType: QueryComplexityErrorType;
  maxPagination?: number;
  requestedPagination?: number;
}

/**
 * GraphQL error `extensions` payload carried by query complexity errors.
 */
interface QueryComplexityExtensions {
  code?: string;
  maxPagination?: number;
  requestedPagination?: number;
}

/** A single GraphQL error entry that may describe a complexity violation. */
interface ComplexityErrorEntry {
  extensions?: QueryComplexityExtensions;
  message?: string;
}

/** Loose shape of the error objects this module inspects. */
interface ComplexityErrorLike extends ComplexityErrorEntry {
  graphQLErrors?: ReadonlyArray<ComplexityErrorEntry>;
}

/** Narrow an unknown error to the loose complexity-error shape, or null. */
function toComplexityError(error: unknown): ComplexityErrorLike | null {
  if (typeof error !== 'object' || error === null) return null;
  return error;
}

/**
 * Check if an error is a query complexity error
 *
 * @param error - Error object to check
 * @returns True if the error is a query complexity error
 */
export function isQueryComplexityError(error: unknown): boolean {
  const err = toComplexityError(error);
  if (!err) return false;

  if (err.graphQLErrors) {
    return err.graphQLErrors.some(
      e =>
        e.extensions?.code ===
        QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
    );
  }

  if (err.extensions) {
    return (
      err.extensions.code === QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED
    );
  }

  return false;
}

/**
 * Extract query complexity error details
 *
 * @param error - Error containing query complexity issue
 * @returns Query complexity details or null
 */
export function getQueryComplexityDetails(
  error: unknown,
): QueryComplexityDetails | null {
  const err = toComplexityError(error);
  if (!err) return null;

  let complexityError: ComplexityErrorEntry | undefined;

  if (err.graphQLErrors) {
    complexityError = err.graphQLErrors.find(
      e =>
        e.extensions?.code ===
        QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
    );
  } else if (err.extensions) {
    complexityError = err;
  }

  if (!complexityError || !complexityError.extensions) {
    return null;
  }

  const { code, ...details } = complexityError.extensions;
  const errorType = code as QueryComplexityErrorType;
  return {
    errorType,
    ...details,
  };
}

/** What the page limit refused, for the log; the user sees `errors.codes.*`. */
export function describeQueryComplexity(error: unknown): string {
  const details = getQueryComplexityDetails(error);
  if (details?.requestedPagination && details.maxPagination) {
    return `Cannot request ${details.requestedPagination} items. Maximum is ${details.maxPagination}.`;
  }
  return 'Pagination limit exceeded. Please request fewer items.';
}
