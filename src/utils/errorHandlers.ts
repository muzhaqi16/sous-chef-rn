/**
 * What settling a mutation shares with its callers: a failure report that
 * stays quiet during a known outage, and the version-conflict alert.
 */

import { alertService } from '#/services/alertService';
import { getVersionConflictMessage } from './errors/versionConflict';
import { errorService } from '#/services/errorService';
import { isNetworkError } from '#/utils/isNetworkError';
import { isOfflineRejectedError } from '#/apollo/offlineQueue/OfflineRejectedError';
import { storeApi } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { t } from '#/i18n';

/**
 * Suppressed ONLY for a network error or an offline rejection while
 * `isApiUnavailable` holds — a validation, permission or conflict error is
 * always reported. Per-call reports during an outage bury real failures (228
 * from one settings session). The query side keeps its telemetry on purpose.
 */
export function reportMutationFailure(error: unknown, operation: string): void {
  if (
    (isNetworkError(error) || isOfflineRejectedError(error)) &&
    isApiUnavailable(storeApi.getState())
  ) {
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

/** The "updated elsewhere" alert, offering the caller's refresh. */
export const alertVersionConflict = (
  config: VersionConflictConfig = {},
): void => {
  const { itemName, onRefresh, customMessage } = config;
  // Parameterized so word order localizes (some languages read "Updated
  // {entity}"). Callers pass an ALREADY-translated label.
  const entity = itemName ?? t('labels.item');

  alertService.alert(
    t('errors.entityUpdatedTitle', { entity }),
    customMessage ?? getVersionConflictMessage(),
    [
      { text: t('labels.refresh'), onPress: () => onRefresh?.() },
      { text: t('labels.cancel'), style: 'cancel' },
    ],
  );
};
