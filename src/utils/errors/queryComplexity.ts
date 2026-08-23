/**
 * Query Complexity Error Handling
 *
 * Handles new API query complexity limits:
 * - Maximum query depth: 10 levels
 * - Maximum fields: 150 fields per query
 * - Pagination limits: 100 items maximum
 */

import { logger } from '#/utils/environment';

/**
 * Query complexity error types
 */
// PAGINATION_LIMIT_EXCEEDED is a TopLevelErrorCode member and would otherwise be
// referenced through the generated enum, but a TypeScript string enum rejects a
// computed initializer, so the value has to be repeated here. QUERY_TOO_COMPLEX
// is in neither generated enum — the API's registry has no such code.
export enum QueryComplexityErrorType {
  TOO_COMPLEX = 'QUERY_TOO_COMPLEX',
  PAGINATION_LIMIT_EXCEEDED = 'PAGINATION_LIMIT_EXCEEDED',
}

/**
 * Query complexity error details
 */
export interface QueryComplexityDetails {
  errorType: QueryComplexityErrorType;
  message: string;
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
  return error as ComplexityErrorLike;
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
  const message = complexityError.message || 'Query complexity limit exceeded';

  return {
    errorType,
    message,
    ...details,
  };
}

/**
 * Get user-friendly message for query complexity error
 *
 * @param error - Error containing query complexity issue
 * @returns User-friendly error message
 */
export function getQueryComplexityMessage(error: unknown): string {
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

/**
 * Handle query complexity errors with automatic recovery
 *
 * @param error - Error to check
 * @param onRetryWithReducedComplexity - Optional callback to retry with reduced complexity
 * @returns True if error was a query complexity error
 *
 * @example
 * ```typescript
 * try {
 *   await fetchData({ first: 500 });
 * } catch (error) {
 *   if (handleQueryComplexityError(error, () => fetchData({ first: 100 }))) {
 *     return; // Error was handled and retry initiated
 *   }
 *   // Handle other errors
 * }
 * ```
 */
export function handleQueryComplexityError(
  error: unknown,
  onRetryWithReducedComplexity?: () => void | Promise<void>,
): boolean {
  if (!isQueryComplexityError(error)) {
    return false;
  }

  const details = getQueryComplexityDetails(error);
  const message = getQueryComplexityMessage(error);

  logger.warn('⚠️ Query complexity error detected:', {
    message,
    details,
    error,
  });

  // If pagination limit exceeded, can automatically retry with reduced pagination
  if (
    details?.errorType === QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED &&
    onRetryWithReducedComplexity
  ) {
    console.log('🔄 Retrying with reduced pagination...');
    onRetryWithReducedComplexity();
  }

  return true;
}
