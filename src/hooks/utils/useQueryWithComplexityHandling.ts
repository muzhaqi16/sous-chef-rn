import { handleQueryComplexityError, isQueryComplexityError } from '#/utils/errors/queryComplexity';
import { validatePagination } from '#/constants/pagination';
import { Alert } from 'react-native';

/**
 * Wrapper to add query complexity error handling to generated query hooks
 *
 * Features:
 * - Detects QUERY_TOO_COMPLEX and PAGINATION_LIMIT_EXCEEDED errors
 * - Shows user-friendly error messages
 * - Provides retry functionality
 *
 * @param queryHookResult - Result from a generated useQuery hook
 * @param onRetry - Optional callback when user wants to retry
 * @returns Enhanced query result with complexity handling
 *
 * @example
 * ```typescript
 * const baseQuery = useGetShoppingListsQuery({ variables: { first: 50 } });
 * const { data, loading, error } = withQueryComplexityHandling(baseQuery, () => {
 *   // Retry with reduced pagination
 *   refetch({ first: 25 });
 * });
 * ```
 */
export function withQueryComplexityHandling<T extends { error?: any; refetch?: any }>(
  queryHookResult: T,
  onRetry?: () => void
): T & { handleComplexityError: () => void } {
  const handleComplexityError = () => {
    const error = queryHookResult.error;

    if (error && isQueryComplexityError(error)) {
      handleQueryComplexityError(error, onRetry);

      // Show user-friendly alert
      Alert.alert(
        'Request Too Large',
        'The request was too complex. Please try with fewer items or simplify your request.',
        [
          { text: 'Cancel', style: 'cancel' },
          onRetry ? { text: 'Retry', onPress: onRetry } : undefined,
        ].filter(Boolean) as any
      );
    }
  };

  // Auto-handle on error if it's a complexity issue
  if (queryHookResult.error && isQueryComplexityError(queryHookResult.error)) {
    handleComplexityError();
  }

  return {
    ...queryHookResult,
    handleComplexityError,
  };
}

/**
 * Hook to validate pagination variables before making a query
 *
 * @param variables - Query variables that may include pagination
 * @returns Validated variables with capped pagination
 *
 * @example
 * ```typescript
 * const variables = useValidatedPagination({
 *   first: 500,  // Will be capped to 100
 *   filter: { status: 'active' }
 * });
 * ```
 */
export function useValidatedPagination<T extends Record<string, any>>(
  variables: T
): T {
  return {
    ...variables,
    ...validatePagination({
      first: variables.first,
      last: variables.last,
      limit: variables.limit,
      take: variables.take,
    }),
  };
}
