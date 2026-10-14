/**
 * What settling a mutation shares with its callers: a failure report that
 * stays quiet during a known outage.
 */

import { errorService } from '#/services/errorService';
import { isNetworkError } from '#/utils/isNetworkError';
import { isOfflineRejectedError } from '#/apollo/offlineQueue/OfflineRejectedError';
import { storeApi } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';

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
