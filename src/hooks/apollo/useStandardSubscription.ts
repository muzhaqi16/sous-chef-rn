import { useRef } from 'react';
import type { ErrorLike } from '@apollo/client';
import { useErrorService } from '#/services/errorService';
import { useSubscriptionDeduplication } from '#/hooks/utils/useSubscriptionDeduplication';

export interface StandardSubscriptionOptions {
  /**
   * The user ID for subscription deduplication (filters out self-echo events)
   * If not provided, deduplication is disabled
   */
  userId?: string;

  /**
   * Operation name for error logging (e.g., 'Pantry Subscription', 'Shopping List Subscription')
   */
  operation: string;

  /**
   * Entity ID for logging (e.g., pantryId, listId)
   */
  entityId?: string;

  /**
   * Enable detailed logging in development mode (default: true)
   * Set to false for simple subscriptions that don't need verbose logs
   */
  enableLogging?: boolean;

  /**
   * Custom onData handler (optional)
   * Called after deduplication check passes
   */
  onData?: (data: { data: Record<string, unknown> }) => void;

  /**
   * Custom error handler (optional)
   * If not provided, uses default error handling with logging
   */
  onError?: (error: ErrorLike) => void;
}

/**
 * Standardized subscription setup hook
 *
 * Provides consistent subscription behavior across the app:
 * - Optional deduplication (filters self-echo events in collaborative editing)
 * - Consistent error handling
 * - Development logging
 * - Auto cache updates via Apollo normalization
 *
 * @example Simple usage (no logging, no deduplication)
 * ```typescript
 * const subscriptionOptions = useStandardSubscription({
 *   operation: 'Shopping List Subscription',
 *   enableLogging: false,
 * });
 *
 * useShoppingListItemsChangedSubscription({
 *   variables: { listId },
 *   skip: !listId,
 *   ...subscriptionOptions,
 * });
 * ```
 *
 * @example Advanced usage (with deduplication and logging)
 * ```typescript
 * const subscriptionOptions = useStandardSubscription({
 *   userId: user?.id,
 *   operation: 'Pantry Subscription',
 *   entityId: pantryId,
 *   enableLogging: true,
 *   onData: ({ data }) => {
 *     // Custom handling after deduplication
 *     console.log('Custom data handling', data);
 *   },
 * });
 *
 * usePantryItemsChangedSubscription({
 *   variables: { pantryId },
 *   skip: !pantryId,
 *   ...subscriptionOptions,
 * });
 * ```
 */
export function useStandardSubscription(options: StandardSubscriptionOptions) {
  const { handleApolloError } = useErrorService();
  const {
    userId,
    operation,
    entityId,
    enableLogging = true,
    onData: customOnData,
    onError: customOnError,
  } = options;

  // Store callbacks in refs to always read the latest version inside handlers,
  // preventing stale closure bugs when callers don't memoize their callbacks
  const customOnDataRef = useRef(customOnData);
  customOnDataRef.current = customOnData;
  const customOnErrorRef = useRef(customOnError);
  customOnErrorRef.current = customOnError;

  // Set up deduplication filter if userId provided
  const shouldProcessUpdate = useSubscriptionDeduplication(userId);

  // Memoize handlers so Apollo subscription doesn't restart on every render
  // Always provide onData when userId is set (for deduplication) or when customOnData is provided
  const needsOnData = !!customOnData || !!userId;
  const onData = needsOnData
        ? ({ data }: { data: { data?: Record<string, unknown> } }) => {
            // Check deduplication if userId provided
            if (userId && data?.data) {
              const payload = Object.values(data.data)[0]; // Get first value (the subscription payload)
              if (!shouldProcessUpdate(payload as Record<string, unknown>)) {
                if (__DEV__ && enableLogging) {
                  console.log(`🔕 ${operation}: Filtered self-echo event`);
                }
                return;
              }
            }

            // Log subscription update in dev mode (optimized string interpolation)
            if (__DEV__ && enableLogging) {
              console.log(
                `🔔 ${operation}: Update received | Entity: ${entityId} | Type: ${data.data?.__typename} | Time: ${new Date().toISOString()}`,
              );
            }

            // Read from ref to always get the latest callback
            customOnDataRef.current?.({ data });
          }
        : undefined;

  // Standardized onError handler
  const onError = customOnError
    ? (error: ErrorLike) => {
        // Read from ref to always get the latest callback
        customOnErrorRef.current?.(error);
      }
    : (error: ErrorLike) => {
        const { message } = handleApolloError(error, { operation });

        if (__DEV__) {
          console.warn(`❌ ${operation}: Error`, {
            entityId,
            error: message,
            timestamp: new Date().toISOString(),
          });
        }

        // Don't refetch on subscription errors - let the query handle reconnection
        // Subscriptions will auto-reconnect when network returns
      };

  // Standardized onComplete handler
  const onComplete = enableLogging
        ? () => {
            if (__DEV__) {
              console.log(`✅ ${operation}: Connected`, entityId);
            }
          }
        : undefined;

  return {
    onData,
    onError,
    onComplete,
  };
}
