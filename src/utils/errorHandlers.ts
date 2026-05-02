/**
 * Inline error handlers used by `useCrudOperations`.
 *
 * Both functions are designed to be called from inside a try/catch in a
 * mutation flow. They handle the user-visible alert and (for the mutation
 * variant) telemetry reporting, returning a boolean so the caller can decide
 * how to continue.
 *
 * For React-component error handling (parsing Apollo errors into structured
 * results), use `useErrorService()` from `src/services/errorService.ts`.
 */

import { alertService } from '#/services/alertService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from './errors/versionConflict';
import { errorService, getErrorMessage } from '#/services/errorService';

export interface VersionConflictConfig {
  /** Name of the item being updated (e.g., "Item", "Home", "Recipe"). */
  itemName?: string;
  /** Callback to refresh data when the user chooses "Refresh". */
  onRefresh?: () => void;
  /** Override the default version-conflict message. */
  customMessage?: string;
}

export interface ApolloErrorConfig {
  /** Name of operation (e.g., "Update Item", "Delete Home"). */
  operation: string;
  /** Override the default error message extracted from the error. */
  customMessage?: string;
  /** Whether to show the alert (default: true). */
  showAlert?: boolean;
}

/**
 * Detect a version-conflict error and prompt the user to refresh.
 *
 * @returns `true` if the error was a version conflict and the alert fired;
 *   `false` if the caller should continue handling the error.
 *
 * @example
 * ```typescript
 * try {
 *   await updateMutation(...);
 * } catch (error) {
 *   if (handleVersionConflictAlert(error, { itemName: 'Item', onRefresh: refetch })) {
 *     return false;
 *   }
 *   // ...handle other errors
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

    alertService.alert(`${itemName} Updated`, message, [
      { text: 'Refresh', onPress: () => onRefresh?.() },
      { text: 'Cancel', style: 'cancel' },
    ]);
    return true;
  }

  return false;
};

/**
 * Show a generic error alert and report the error to telemetry.
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

  const errorMessage = customMessage || getErrorMessage(error);

  if (showAlert) {
    alertService.alert('Error', errorMessage);
  }

  errorService.reportError(error, { operation });
};
