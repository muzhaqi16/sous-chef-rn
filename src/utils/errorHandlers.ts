/**
 * Error Handling Utilities - Reusable error handlers for mutations
 *
 * These utilities provide consistent error handling patterns across the application.
 * They can be composed and reused to reduce boilerplate in management hooks.
 *
 * Usage:
 * ```typescript
 * // Wrap mutation calls with error handlers
 * const safeMutation = withVersionConflictHandling(
 *   withApolloErrorHandling(mutationFn, 'Update Item'),
 *   refetch,
 *   'Item'
 * );
 * ```
 */

import { Alert } from 'react-native';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from './errors/versionConflict';

/**
 * Version conflict handler configuration
 */
export interface VersionConflictConfig {
  itemName?: string; // Name of item being updated (e.g., "Item", "Home", "Recipe")
  onRefresh?: () => void; // Callback to refresh data
  customMessage?: string; // Override default message
}

/**
 * Apollo error handler configuration
 */
export interface ApolloErrorConfig {
  operation: string; // Name of operation (e.g., "Update Item", "Delete Home")
  customMessage?: string; // Override default message
  showAlert?: boolean; // Whether to show alert (default: true)
}

/**
 * Higher-order function that adds version conflict handling to a mutation
 *
 * @param fn - The mutation function to wrap
 * @param config - Configuration for version conflict handling
 * @returns Wrapped function with version conflict handling
 *
 * @example
 * ```typescript
 * const updateItem = withVersionConflictHandling(
 *   async (id, data) => await updateMutation({ variables: { id, input: data } }),
 *   { itemName: 'Item', onRefresh: refetch }
 * );
 * ```
 */
export const withVersionConflictHandling =
  <TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    config: VersionConflictConfig = {},
  ) =>
  async (...args: TArgs): Promise<TReturn | false> => {
    const { itemName = 'Item', onRefresh, customMessage } = config;

    try {
      return await fn(...args);
    } catch (error: any) {
      if (handleVersionConflict(error)) {
        const message =
          customMessage || getVersionConflictMessage(error);

        Alert.alert(`${itemName} Updated`, message, [
          { text: 'Refresh', onPress: () => onRefresh?.() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return false as TReturn;
      }
      // Re-throw if not a version conflict
      throw error;
    }
  };

/**
 * Higher-order function that adds generic error handling to a mutation with Apollo-like error
 * Use this for operations that need consistent error alerting
 *
 * Note: This doesn't use useErrorHandler hook since it's not a React component/hook.
 * For Apollo-specific error handling with useErrorHandler, handle errors directly in your hooks.
 *
 * @param fn - The mutation function to wrap
 * @param config - Configuration for Apollo error handling
 * @returns Wrapped function with Apollo error handling
 *
 * @example
 * ```typescript
 * const addItem = withMutationErrorHandling(
 *   async (input) => await addMutation({ variables: { input } }),
 *   { operation: 'Add Item' }
 * );
 * ```
 */
export const withMutationErrorHandling =
  <TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    config: ApolloErrorConfig,
  ) =>
  async (...args: TArgs): Promise<TReturn | false> => {
    const { operation, customMessage, showAlert = true } = config;

    try {
      return await fn(...args);
    } catch (error: any) {
      const errorMessage =
        customMessage ||
        error?.message ||
        'An unexpected error occurred';

      if (showAlert) {
        Alert.alert('Error', errorMessage);
      }

      console.error(`${operation} error:`, error);
      return false as TReturn;
    }
  };

/**
 * Higher-order function that adds generic error handling to a mutation
 * Use this for simple operations that don't need Apollo-specific handling
 *
 * @param fn - The mutation function to wrap
 * @param errorMessage - Error message to display
 * @param logMessage - Optional custom log message
 * @returns Wrapped function with error handling
 *
 * @example
 * ```typescript
 * const deleteItem = withGenericErrorHandling(
 *   async (id) => await deleteMutation({ variables: { id } }),
 *   'Failed to delete item'
 * );
 * ```
 */
export const withGenericErrorHandling =
  <TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    errorMessage: string = 'Operation failed. Please try again.',
    logMessage?: string,
  ) =>
  async (...args: TArgs): Promise<TReturn | false> => {
    try {
      return await fn(...args);
    } catch (error: any) {
      Alert.alert('Error', errorMessage);
      console.error(logMessage || errorMessage, error);
      return false as TReturn;
    }
  };

/**
 * Compose multiple error handlers together
 * Applies handlers in order: first handler wraps the function, then second wraps the result, etc.
 *
 * @param fn - The mutation function to wrap
 * @param handlers - Array of handler functions to apply
 * @returns Wrapped function with all handlers applied
 *
 * @example
 * ```typescript
 * const safeMutation = composeErrorHandlers(
 *   updateMutation,
 *   [
 *     (fn) => withVersionConflictHandling(fn, { itemName: 'Item', onRefresh: refetch }),
 *     (fn) => withApolloErrorHandling(fn, { operation: 'Update Item' })
 *   ]
 * );
 * ```
 */
export const composeErrorHandlers = <TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  handlers: Array<(fn: (...args: TArgs) => Promise<TReturn | false>) => (...args: TArgs) => Promise<TReturn | false>>,
): ((...args: TArgs) => Promise<TReturn | false>) => {
  return handlers.reduce(
    (wrappedFn, handler) => handler(wrappedFn),
    fn as (...args: TArgs) => Promise<TReturn | false>,
  );
};

/**
 * Creates a version conflict alert without wrapping a function
 * Useful for inline error handling in try/catch blocks
 *
 * @param error - The error object
 * @param config - Configuration for version conflict handling
 * @returns true if version conflict was handled, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await updateMutation(...);
 * } catch (error) {
 *   if (handleVersionConflictAlert(error, { itemName: 'Item', onRefresh: refetch })) {
 *     return false;
 *   }
 *   // Handle other errors...
 * }
 * ```
 */
export const handleVersionConflictAlert = (
  error: any,
  config: VersionConflictConfig = {},
): boolean => {
  const { itemName = 'Item', onRefresh, customMessage } = config;

  if (handleVersionConflict(error)) {
    const message = customMessage || getVersionConflictMessage(error);

    Alert.alert(`${itemName} Updated`, message, [
      { text: 'Refresh', onPress: () => onRefresh?.() },
      { text: 'Cancel', style: 'cancel' },
    ]);
    return true;
  }

  return false;
};

/**
 * Creates a generic error alert without wrapping a function
 * Useful for inline error handling in try/catch blocks
 *
 * Note: This doesn't use useErrorHandler hook. For Apollo-specific error handling,
 * use handleApolloError from useErrorHandler directly in your hooks.
 *
 * @param error - The error object
 * @param config - Configuration for error handling
 *
 * @example
 * ```typescript
 * try {
 *   await addMutation(...);
 * } catch (error) {
 *   handleMutationErrorAlert(error, { operation: 'Add Item' });
 *   return false;
 * }
 * ```
 */
export const handleMutationErrorAlert = (
  error: any,
  config: ApolloErrorConfig,
): void => {
  const { operation, customMessage, showAlert = true } = config;

  const errorMessage =
    customMessage || error?.message || 'An unexpected error occurred';

  if (showAlert) {
    Alert.alert('Error', errorMessage);
  }

  console.error(`${operation} error:`, error);
};
