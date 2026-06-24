/**
 * Mutation error handlers — composable error-check chains.
 *
 * `handleMutationError` replaces per-hook if/else-if chains. Pass an array of
 * pre-built checks (`versionConflictCheck`, `invalidUnitCheck`, etc.) and the
 * function runs through them in order, falling back to a generic alert+report.
 *
 * Lower-level `handleVersionConflictAlert` and `handleMutationErrorAlert` are
 * still exported for the few call-sites that need direct access.
 */

import { alertService } from '#/services/alertService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from './errors/versionConflict';
import {
  isInvalidUnitError,
  getInvalidUnitMessage,
} from './errors/invalidUnit';
import { errorService, getErrorMessage } from '#/services/errorService';
import { t } from '#/i18n/t';

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
  error: unknown,
  config: VersionConflictConfig = {},
): boolean => {
  const { itemName = 'Item', onRefresh, customMessage } = config;

  if (handleVersionConflict(error)) {
    const message = customMessage || getVersionConflictMessage(error);

    alertService.alert(`${itemName} ${t('labels.updated')}`, message, [
      { text: t('labels.refresh'), onPress: () => onRefresh?.() },
      { text: t('labels.cancel'), style: 'cancel' },
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
  error: unknown,
  config: ApolloErrorConfig,
): void => {
  const { operation, customMessage, showAlert = true } = config;

  const errorMessage = customMessage || getErrorMessage(error);

  if (showAlert) {
    alertService.alert(t('labels.error'), errorMessage);
  }

  errorService.reportError(error, { operation });
};

// ---------------------------------------------------------------------------
// Composable error-check chain
// ---------------------------------------------------------------------------

export interface MutationErrorCheck {
  detect: (error: unknown) => boolean;
  handle: (error: unknown) => void;
}

export interface MutationErrorHandlerConfig {
  operation: string;
  checks?: MutationErrorCheck[];
  showAlert?: boolean;
}

/**
 * Run `error` through an ordered list of checks, then fall back to generic
 * alert + telemetry report.
 *
 * @example
 * ```ts
 * if (result.error) {
 *   handleMutationError(result.error, {
 *     operation: 'Adjust Quantity',
 *     checks: [versionConflictCheck(), invalidUnitCheck()],
 *   });
 * }
 * ```
 */
export function handleMutationError(
  error: unknown,
  config: MutationErrorHandlerConfig,
): void {
  for (const check of config.checks ?? []) {
    if (check.detect(error)) {
      check.handle(error);
      return;
    }
  }
  handleMutationErrorAlert(error, {
    operation: config.operation,
    showAlert: config.showAlert,
  });
}

// ---------------------------------------------------------------------------
// Pre-built error checks
// ---------------------------------------------------------------------------

export function versionConflictCheck(
  opts?: VersionConflictConfig,
): MutationErrorCheck {
  return {
    detect: error => handleVersionConflict(error),
    handle: error => handleVersionConflictAlert(error, opts),
  };
}

export function invalidUnitCheck(): MutationErrorCheck {
  return {
    detect: error => isInvalidUnitError(error),
    handle: error => {
      alertService.alert(
        t('errors.invalidUnitTitle'),
        getInvalidUnitMessage(error),
      );
    },
  };
}
