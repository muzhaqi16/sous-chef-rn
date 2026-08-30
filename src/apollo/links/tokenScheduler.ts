import { jwtDecode } from 'jwt-decode';
import { useStore } from '#store';
import { logger } from '#/utils/environment';

interface TokenPayload {
  exp: number;
  iat: number;
  userId: string;
}

let refreshTimer: NodeJS.Timeout | null = null;

/**
 * Expiry of the token that last scheduled an IMMEDIATE refresh. Zero-delay
 * scheduling is a chain (refresh → setTokens → schedule) that nothing else
 * bounds, so this enforces a floor between chained refreshes and gives up once
 * a refresh stops moving the expiry forward.
 */
let lastImmediateRefreshExpiry: number | null = null;

/**
 * Space chained immediate refreshes. Only reached when a token's whole
 * lifetime is shorter than the buffer below — with the default one-hour
 * `ACCESS_TOKEN_EXPIRY` against a ten-minute buffer this never runs. Matches
 * `MIN_REFRESH_INTERVAL` in refreshToken.ts.
 */
const CHAINED_IMMEDIATE_REFRESH_DELAY_MS = 5000;

/**
 * Refresh proactively `REFRESH_BUFFER_MS` before expiry, so a 401 never reaches
 * the user. Skipped while offline — `errorLink` refreshes reactively on the
 * next request instead, and a network failure never signs anyone out.
 */
export function scheduleTokenRefresh(
  accessToken: string,
  refreshCallback: () => Promise<void>,
) {
  // Clear any existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  try {
    // Decode JWT to get expiration time
    const decoded = jwtDecode<TokenPayload>(accessToken);
    const expiresAt = decoded.exp * 1000; // Convert to milliseconds
    const now = Date.now();

    // 10 minutes of margin for network latency, backgrounding and device
    // wake-up. A one-hour token therefore refreshes at 50 minutes.
    const REFRESH_BUFFER_MS = 10 * 60 * 1000;
    const refreshAt = expiresAt - REFRESH_BUFFER_MS;

    // A token already inside the buffer — or restored from storage long past
    // its expiry — refreshes NOW rather than not at all. Otherwise the exchange
    // waits for a request to be refused first, and the user sees that refusal
    // on whichever screen loads.
    const untilRefresh = refreshAt - now;
    let delay: number;

    if (untilRefresh > 0) {
      delay = untilRefresh;
      lastImmediateRefreshExpiry = null;
    } else {
      // A refresh that did not move the expiry forward is not going to on the
      // next attempt either. Stop, and let the reactive refresh handle it when
      // a request is actually refused, rather than spinning against it.
      if (
        lastImmediateRefreshExpiry !== null &&
        expiresAt <= lastImmediateRefreshExpiry
      ) {
        logger.warn(
          '[TokenScheduler] Immediate refresh did not extend the token; ' +
            'leaving expiry to the reactive refresh instead of rescheduling.',
        );
        return;
      }

      // First one is instant, which is the case worth being instant for: a
      // stale token restored at cold start. A chain of them is spaced, so a
      // deployment whose access tokens live less than the buffer cannot turn
      // this into an unthrottled rotation loop.
      delay =
        lastImmediateRefreshExpiry === null
          ? 0
          : CHAINED_IMMEDIATE_REFRESH_DELAY_MS;
      lastImmediateRefreshExpiry = expiresAt;
    }

    logger.debug(
      `[TokenScheduler] Scheduling proactive refresh in ${Math.round(
        delay / 1000,
      )}s ` + `(token expires in ${Math.round((expiresAt - now) / 1000)}s)`,
    );

    refreshTimer = setTimeout(async () => {
      // Skip the refresh while offline. `getState()` rather than the hook —
      // this runs in a setTimeout callback, outside React.
      const state = useStore.getState();
      if (!state.isOnline) {
        logger.debug(
          '[TokenScheduler] Skipping proactive refresh - device is offline. ' +
            'Reactive refresh will handle token expiration when back online.',
        );
        return;
      }

      logger.debug('[TokenScheduler] Proactive token refresh triggered');
      try {
        await refreshCallback();
        logger.debug(
          '[TokenScheduler] Proactive token refresh completed successfully',
        );
      } catch (error) {
        logger.error('[TokenScheduler] Proactive refresh failed:', error);
        // Reactive refresh (errorLink) will handle it if this fails
        // This is our fallback - user may experience a brief 401 error
      }
    }, delay);
  } catch (error) {
    logger.error(
      '[TokenScheduler] Failed to decode token for scheduling:',
      error,
    );
    // Don't throw - reactive refresh will handle token expiration
  }
}

/** Cancel the scheduled refresh — always call on logout. */
export function cancelTokenRefresh() {
  lastImmediateRefreshExpiry = null;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    logger.debug('[TokenScheduler] Scheduled refresh cancelled');
  }
}

/**
 * Get current schedule state (for debugging and testing)
 * @returns Object with schedule status
 */
export function getScheduleState() {
  return {
    isScheduled: refreshTimer !== null,
  };
}
