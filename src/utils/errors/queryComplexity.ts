/**
 * The API's query complexity limits: depth 10, 150 fields per query, 100 items
 * per page.
 */

// PAGINATION_LIMIT_EXCEEDED is a TopLevelErrorCode member, repeated literally
// because a TS string enum rejects a computed initializer. QUERY_TOO_COMPLEX is
// in neither generated enum — the API's registry has no such code.
export enum QueryComplexityErrorType {
  TOO_COMPLEX = 'QUERY_TOO_COMPLEX',
  PAGINATION_LIMIT_EXCEEDED = 'PAGINATION_LIMIT_EXCEEDED',
}

/**
 * Query complexity error details
 */
export interface QueryComplexityDetails {
  errorType: QueryComplexityErrorType;
  maxDepth?: number;
  actualDepth?: number;
  maxFields?: number;
  actualFields?: number;
  maxPagination?: number;
  requestedPagination?: number;
}

/**
 * GraphQL error `extensions` payload carried by query complexity errors.
 */
interface QueryComplexityExtensions {
  code?: string;
  maxDepth?: number;
  actualDepth?: number;
  maxFields?: number;
  actualFields?: number;
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
        e.extensions?.code === QueryComplexityErrorType.TOO_COMPLEX ||
        e.extensions?.code ===
          QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
    );
  }

  if (err.extensions) {
    return (
      err.extensions.code === QueryComplexityErrorType.TOO_COMPLEX ||
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
        e.extensions?.code === QueryComplexityErrorType.TOO_COMPLEX ||
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

/** What the complexity limit refused, for the log; the user sees `errors.codes.*`. */
export function describeQueryComplexity(error: unknown): string {
  const details = getQueryComplexityDetails(error);

  if (!details) {
    return 'The request was too complex. Please try again with less data.';
  }

  switch (details.errorType) {
    case QueryComplexityErrorType.TOO_COMPLEX:
      if (details.actualDepth && details.maxDepth) {
        return `Query is too complex (depth: ${details.actualDepth}, max: ${details.maxDepth}). Please simplify your request.`;
      }
      if (details.actualFields && details.maxFields) {
        return `Query requests too many fields (${details.actualFields}, max: ${details.maxFields}). Please reduce the number of fields.`;
      }
      return 'Query is too complex. Please simplify your request.';

    case QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED:
      if (details.requestedPagination && details.maxPagination) {
        return `Cannot request ${details.requestedPagination} items. Maximum is ${details.maxPagination} items per request.`;
      }
      return 'Pagination limit exceeded. Please request fewer items.';

    default:
      return 'Query complexity limit exceeded. Please simplify your request.';
  }
}
