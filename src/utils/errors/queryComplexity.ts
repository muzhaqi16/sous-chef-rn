/**
 * Query Complexity Error Handling
 *
 * Handles new API query complexity limits:
 * - Maximum query depth: 10 levels
 * - Maximum fields: 150 fields per query
 * - Pagination limits: 100 items maximum
 */

/**
 * Query complexity error types
 */
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
 * Check if an error is a query complexity error
 *
 * @param error - Error object to check
 * @returns True if the error is a query complexity error
 */
export function isQueryComplexityError(error: any): boolean {
  if ('graphQLErrors' in error && error.graphQLErrors) {
    return error.graphQLErrors.some(
      (err: any) =>
        err.extensions?.code === QueryComplexityErrorType.TOO_COMPLEX ||
        err.extensions?.code ===
          QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
    );
  }

  if ('extensions' in error && error.extensions) {
    return (
      error.extensions.code === QueryComplexityErrorType.TOO_COMPLEX ||
      error.extensions.code ===
        QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED
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
  error: any,
): QueryComplexityDetails | null {
  let complexityError: any | undefined;

  if ('graphQLErrors' in error && error.graphQLErrors) {
    complexityError = error.graphQLErrors.find(
      (err: any) =>
        err.extensions?.code === QueryComplexityErrorType.TOO_COMPLEX ||
        err.extensions?.code ===
          QueryComplexityErrorType.PAGINATION_LIMIT_EXCEEDED,
    );
  } else if ('extensions' in error && error.extensions) {
    complexityError = error;
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
export function getQueryComplexityMessage(error: any): string {
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
  error: any,
  onRetryWithReducedComplexity?: () => void | Promise<void>,
): boolean {
  if (!isQueryComplexityError(error)) {
    return false;
  }

  const details = getQueryComplexityDetails(error);
  const message = getQueryComplexityMessage(error);

  console.warn('⚠️ Query complexity error detected:', {
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
