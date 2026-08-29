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
import { errorService, localizedErrorMessage } from '#/services/errorService';
import { isNetworkError } from '#/utils/isNetworkError';
import { storeApi } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { t } from '#/i18n';
import { getI18n } from '#/i18n/config';

/**
 * Report a mutation failure, unless it's a network error we already know about.
 *
 * During an outage every mutation that reaches an error handler would otherwise
 * write a full console error AND a `Telemetry.trackError` — one settings screen
 * session against a down API produced 228 of them, all describing the same
 * condition. The breaker's one-line verdict and `networkStatusLink`'s
 * per-operation warning are the signal then; per-call reports are noise that
 * buries real failures and inflates error telemetry.
 *
 * Deliberately narrow: only NETWORK errors are suppressed, and only while
 * `isApiUnavailable` holds. A validation / permission / conflict error is a real
 * defect report and is always sent, outage or not.
 *
 * This goes one step further than the query-side guard in `useApolloErrorLogger`,
 * which suppresses only the `__DEV__` console warning and still emits its
 * telemetry during an outage. The asymmetry is intended: a query re-fires on its
 * own, so its error count is roughly "screens mounted" and is the signal that
 * says how wide the outage is. A mutation error is one-per-user-action, so its
 * count is really "how many times did the user retry", which tells you nothing
 * the query side hasn't already said and drowns out unrelated failures.
 */
function reportMutationFailure(error: unknown, operation: string): void {
  if (isNetworkError(error) && isApiUnavailable(storeApi.getState())) {
    return;
  }
  errorService.reportError(error, { operation });
}

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
 *   if (handleVersionConflictAlert(error, { onRefresh: refetch })) {
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
  if (handleVersionConflict(error)) {
    alertVersionConflict({
      ...config,
      customMessage: config.customMessage || getVersionConflictMessage(),
    });
    return true;
  }

  return false;
};

/**
 * Show the version-conflict alert (title + Refresh/Cancel actions). Shared by
 * the thrown-error path ({@link handleVersionConflictAlert}) and the
 * errors-as-data path — a resolved `ConflictError` union member routes here so
 * it reaches the same Refresh UX instead of a generic alert.
 */
export const alertVersionConflict = (
  config: VersionConflictConfig = {},
): void => {
  const { itemName, onRefresh, customMessage } = config;
  // Parameterized so the entity + word order localize per language (some read
  // "Updated {entity}", not "{entity} Updated"). Callers pass an already-
  // translated entity label; the default is the generic localized "item".
  const entity = itemName ?? t('labels.item');

  alertService.alert(
    getI18n().t('errors.entityUpdatedTitle', { entity }),
    customMessage || getVersionConflictMessage(),
    [
      { text: t('labels.refresh'), onPress: () => onRefresh?.() },
      { text: t('labels.cancel'), style: 'cancel' },
    ],
  );
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

  // Localized copy resolved from the error's CODE — never the server's message,
  // which is unlocalizable English and used to reach the alert verbatim.
  const errorMessage = customMessage || localizedErrorMessage(error);

  if (showAlert) {
    alertService.alert(t('labels.error'), errorMessage);
  }

  // The ALERT is unconditional — the user acted and deserves an answer. Only
  // the report is suppressed for an already-known outage.
  reportMutationFailure(error, operation);
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
