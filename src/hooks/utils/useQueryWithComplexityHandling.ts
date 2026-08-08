import { useEffect, useRef } from 'react';
import type { ErrorLike } from '@apollo/client';
import {
  handleQueryComplexityError,
  isQueryComplexityError,
} from '#/utils/errors/queryComplexity';
import { validatePagination } from '#/constants/pagination';
import { t } from '#/i18n/t';
import { alertService, type AlertButton } from '#/services/alertService';

/**
 * Wrapper to add query complexity error handling to generated query hooks
 *
 * Features:
 * - Detects QUERY_TOO_COMPLEX and PAGINATION_LIMIT_EXCEEDED errors
 * - Shows user-friendly error messages (once per error instance)
 * - Provides retry functionality
 *
 * @param queryHookResult - Result from a generated useQuery hook
 * @param onRetry - Optional callback when user wants to retry
 * @returns Enhanced query result with complexity handling
 *
 * @example
 * ```typescript
 * const baseQuery = useGetShoppingListsQuery({ variables: { first: 50 } });
 * const result = useQueryWithComplexityHandling(baseQuery, () => {
 *   // Retry with reduced pagination
 *   refetch({ first: 25 });
 * });
 * ```
 */
export function useQueryWithComplexityHandling<
  T extends { error?: ErrorLike; refetch?: (...args: unknown[]) => unknown },
>(
  queryHookResult: T,
  onRetry?: () => void,
): T & { handleComplexityError: () => void } {
  const hasShownAlertRef = useRef(false);
  const lastErrorRef = useRef<ErrorLike | null>(null);

  const handleComplexityError = () => {
    const error = queryHookResult.error;

    if (error && isQueryComplexityError(error)) {
      handleQueryComplexityError(error, onRetry);

      alertService.alert(
        t('complexity.title'),
        t('complexity.body'),
        (
          [
            { text: t('labels.cancel'), style: 'cancel' },
            onRetry ? { text: t('labels.retry'), onPress: onRetry } : undefined,
          ] as (AlertButton | undefined)[]
        ).filter((b): b is AlertButton => b != null),
      );
    }
  };

  // Show alert once per unique error instance via useEffect
  useEffect(() => {
    if (
      queryHookResult.error &&
      isQueryComplexityError(queryHookResult.error) &&
      queryHookResult.error !== lastErrorRef.current
    ) {
      lastErrorRef.current = queryHookResult.error;
      hasShownAlertRef.current = true;

      // Inline handleComplexityError logic to avoid dependency on function that changes every render
      const error = queryHookResult.error;
      handleQueryComplexityError(error, onRetry);
      alertService.alert(
        t('complexity.title'),
        t('complexity.body'),
        (
          [
            { text: t('labels.cancel'), style: 'cancel' },
            onRetry ? { text: t('labels.retry'), onPress: onRetry } : undefined,
          ] as (AlertButton | undefined)[]
        ).filter((b): b is AlertButton => b != null),
      );
    } else if (!queryHookResult.error) {
      // Reset when error clears
      hasShownAlertRef.current = false;
      lastErrorRef.current = null;
    }
  }, [queryHookResult.error, onRetry]);

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
/** Optional cursor/offset pagination fields capped by `validatePagination`. */
interface PaginationVariables {
  first?: number;
  last?: number;
  limit?: number;
  take?: number;
}

export function useValidatedPagination<
  T extends Record<string, unknown> & PaginationVariables,
>(variables: T): T {
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
