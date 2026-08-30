/**
 * Composable mutation error handling: `handleMutationError` runs an ordered list
 * of pre-built checks and falls back to a generic alert + report. The individual
 * handlers stay exported for call sites that need one directly.
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
 * Suppressed ONLY for a network error while `isApiUnavailable` holds — a
 * validation, permission or conflict error is always reported. Per-call reports
 * during an outage bury real failures (228 from one settings session). The query
 * side keeps its telemetry on purpose: it measures the outage's width.
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
 * @returns `true` when the alert fired; `false` means the caller should keep
 *   handling the error.
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
 * Shared by the thrown-error path ({@link handleVersionConflictAlert}) and the
 * errors-as-data path, so a resolved `ConflictError` reaches the same Refresh UX.
 */
export const alertVersionConflict = (
  config: VersionConflictConfig = {},
): void => {
  const { itemName, onRefresh, customMessage } = config;
  // Parameterized so word order localizes (some languages read "Updated
  // {entity}"). Callers pass an ALREADY-translated label.
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

/** Generic error alert plus a telemetry report. */
export const handleMutationErrorAlert = (
  error: unknown,
  config: ApolloErrorConfig,
): void => {
  const { operation, customMessage, showAlert = true } = config;

  // Resolved from the error's CODE. NEVER the server's message, which is
  // unlocalizable English and would reach the alert verbatim.
  const errorMessage = customMessage || localizedErrorMessage(error);

  if (showAlert) {
    alertService.alert(t('labels.error'), errorMessage);
  }

  // The ALERT is unconditional — the user acted and deserves an answer. Only
  // the report is suppressed for an already-known outage.
  reportMutationFailure(error, operation);
};

// --- Composable error-check chain ---

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
 * Runs `error` through the checks in order, then falls back to a generic alert
 * plus telemetry report.
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

// --- Pre-built error checks ---

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
