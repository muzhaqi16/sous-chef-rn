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
 * Schedule proactive token refresh before expiration
 * Best practice: Refresh 5 minutes before token expires (1 hour token → refresh at 55 min)
 *
 * This implements the "Proactive (Recommended)" strategy from authentication best practices:
 * - Eliminates user-facing 401 errors
 * - Provides smoother UX (no momentary failures)
 * - Reduces concurrent refresh requests
 * - Cleaner logs (no expected 401 errors)
 *
 * OFFLINE PROTECTION:
 * - Checks network status before attempting refresh
 * - Skips refresh if device is offline (saves battery, prevents errors)
 * - Reactive refresh (errorLink) handles token expiration when back online
 * - User NEVER logged out due to network errors
 * - Cache always preserved during offline periods
 *
 * @param accessToken - The JWT access token to decode for expiration
 * @param refreshCallback - Async function to call when refresh is needed
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

    // Refresh 10 minutes (600 seconds) before expiration
    // Configuration: Can be adjusted based on security requirements
    // - 2 minutes: Very conservative (high security apps)
    // - 5 minutes: Standard (industry baseline)
    // - 10 minutes: Recommended (better UX with margin for delays) ← DEFAULT
    // - 15 minutes: Aggressive (maximum UX, less secure)
    //
    // Increased to 10 minutes to provide more margin for:
    // - Network delays and latency
    // - App being backgrounded
    // - Device wake-up latency
    // - Offline->online transitions
    const REFRESH_BUFFER_MS = 10 * 60 * 1000;
    const refreshAt = expiresAt - REFRESH_BUFFER_MS;
    const delay = refreshAt - now;

    // Only schedule if token has more than the buffer time left
    if (delay > 0) {
      logger.debug(
        `[TokenScheduler] Scheduling proactive refresh in ${Math.round(
          delay / 1000,
        )}s ` + `(token expires in ${Math.round((expiresAt - now) / 1000)}s)`,
      );

      refreshTimer = setTimeout(async () => {
        // OFFLINE PROTECTION: Check network status before attempting refresh
        // This prevents unnecessary network attempts and battery drain when offline
        //
        // NOTE: Using direct store access (getState) instead of useNetworkState() hook
        // because this code runs outside React component lifecycle (setTimeout callback).
        // React hooks can only be used inside React components, but Zustand's getState()
        // is specifically designed for accessing state from non-React code.
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
    } else {
      logger.warn(
        `[TokenScheduler] Token expires too soon (in ${Math.round(
          (expiresAt - now) / 1000,
        )}s), ` +
          'skipping proactive refresh. Reactive refresh will handle expiration.',
      );
    }
  } catch (error) {
    logger.error(
      '[TokenScheduler] Failed to decode token for scheduling:',
      error,
    );
    // Don't throw - reactive refresh will handle token expiration
  }
}

/**
 * Cancel scheduled token refresh (call on logout)
 * Important: Always call this when user logs out to prevent
 * unnecessary refresh attempts with invalid tokens
 */
export function cancelTokenRefresh() {
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
