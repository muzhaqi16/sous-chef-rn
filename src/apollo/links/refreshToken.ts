import { Observable } from '@apollo/client';
import { jwtDecode } from 'jwt-decode';
import { logger } from '#/utils/environment';
import { useStore } from '#store';
import { RefreshTokenDocument, RefreshTokenMutation } from '#generated';
import { reconnectWebSocket, isWebSocketReconnecting } from './wsLink';
import { client } from '../client';

// Enhanced token refresh with mutex pattern and retry logic
interface RefreshState {
  isRefreshing: boolean;
  refreshPromise: Promise<string | null> | null;
  retryCount: number;
  lastRefreshTime: number;
}

let refreshState: RefreshState = {
  isRefreshing: false,
  refreshPromise: null,
  retryCount: 0,
  lastRefreshTime: 0,
};

let refreshQueue: Array<(token: string | null) => void> = [];

// Configuration
const REFRESH_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // Base delay in ms
  MIN_REFRESH_INTERVAL: 5000, // Minimum time between refresh attempts
  BACKOFF_MULTIPLIER: 2,
};

const processQueue = (token: string | null) => {
  const callbacks = [...refreshQueue];
  refreshQueue = [];

  callbacks.forEach(callback => {
    try {
      callback(token);
    } catch (error) {
      logger.error('Error processing refresh queue callback:', error);
    }
  });
};

const resetRefreshState = () => {
  refreshState = {
    isRefreshing: false,
    refreshPromise: null,
    retryCount: 0,
    lastRefreshTime: 0,
  };
};

const canAttemptRefresh = (): boolean => {
  const now = Date.now();
  const timeSinceLastRefresh = now - refreshState.lastRefreshTime;

  // Prevent too frequent refresh attempts
  if (timeSinceLastRefresh < REFRESH_CONFIG.MIN_REFRESH_INTERVAL) {
    logger.warn('Token refresh attempted too soon, throttling');
    return false;
  }

  // Check retry limit
  if (refreshState.retryCount >= REFRESH_CONFIG.MAX_RETRIES) {
    logger.error('Max token refresh retries exceeded');
    return false;
  }

  return true;
};

const calculateRetryDelay = (retryCount: number): number => {
  return REFRESH_CONFIG.RETRY_DELAY_BASE * Math.pow(REFRESH_CONFIG.BACKOFF_MULTIPLIER, retryCount);
};

// Helper to detect if error is network-related (vs auth-related)
const isNetworkError = (error: any): boolean => {
  // Check error message for common network error patterns
  const message = (error?.message || error?.networkError?.message || '').toLowerCase();
  const networkPatterns = [
    'network request failed',
    'network error',
    'connection refused',
    'timeout',
    'enotfound',
    'econnrefused',
    'econnreset',
    'ehostunreach',
    'fetch failed',
    'socket closed',        // WebSocket connection failures
    'websocket',            // Generic WebSocket errors
    'ws connection',        // WebSocket connection issues
    'connection lost',      // General connection lost
    'no connection',        // Offline state
    'unreachable',          // Server unreachable
  ];

  return networkPatterns.some(pattern => message.includes(pattern));
};

const performTokenRefresh = async (): Promise<string | null> => {
  const state = useStore.getState();
  const refreshToken = state.refreshToken;

  if (!refreshToken) {
    logger.error('Token refresh failed: No refresh token available');
    state.tokenRefreshFailed(false); // No refresh token = don't clear cache (might be temporary state)
    throw new Error('No refresh token available');
  }

  refreshState.lastRefreshTime = Date.now();
  refreshState.retryCount++;

  try {
    logger.info(`Attempting token refresh (attempt ${refreshState.retryCount}/${REFRESH_CONFIG.MAX_RETRIES})`);

    const response = await client.mutate({
      mutation: RefreshTokenDocument,
      variables: { token: refreshToken },
      context: { skipErrorLink: true },
      errorPolicy: 'all', // Allow partial data on errors
    });

    const data = (response.data as RefreshTokenMutation)?.refresh;
    if (!data?.accessToken || !data?.refreshToken) {
      throw new Error('Invalid refresh response: Missing tokens');
    }

    const { accessToken: newToken, refreshToken: newRefreshToken } = data;

    // Update tokens in store
    state.setTokens({ accessToken: newToken, refreshToken: newRefreshToken });

    // Reconnect WebSocket if needed
    if (!isWebSocketReconnecting()) {
      try {
        reconnectWebSocket();
      } catch (wsError) {
        logger.warn('WebSocket reconnection failed:', wsError);
        // Don't fail the entire refresh for WebSocket issues
      }
    }

    // Reset retry count on successful refresh
    refreshState.retryCount = 0;
    logger.info('Token refresh successful');

    return newToken;
  } catch (error: any) {
    logger.error(`Token refresh failed (attempt ${refreshState.retryCount}):`, error);

    // IMPORTANT: Check network errors FIRST before auth errors
    // This prevents offline scenarios from incorrectly clearing the cache
    const isNetworkFailure = isNetworkError(error);

    if (isNetworkFailure) {
      logger.warn(
        `Token refresh failed due to network error (attempt ${refreshState.retryCount}/${REFRESH_CONFIG.MAX_RETRIES}), cache will be preserved:`,
        error.message
      );

      // For network errors, we retry but DON'T trigger logout after max retries
      if (refreshState.retryCount < REFRESH_CONFIG.MAX_RETRIES) {
        const delay = calculateRetryDelay(refreshState.retryCount - 1);
        logger.info(`Will retry token refresh in ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return performTokenRefresh(); // Recursive retry
      }

      // Max retries exceeded - preserve cache, don't logout
      logger.warn('Token refresh failed due to network error after max retries, preserving cache for offline usage');
      throw error; // Just fail the operation, don't trigger session expiry
    }

    // ONLY check for auth errors if NOT a network error
    const isTokenExpiredError =
      error?.networkError?.statusCode === 401 ||
      error?.graphQLErrors?.some((e: any) =>
        e.extensions?.code === 'UNAUTHENTICATED' ||
        e.message?.toLowerCase().includes('expired')
      );

    if (isTokenExpiredError) {
      logger.info('Refresh token expired (genuine auth error), triggering logout with cache clear');
      state.tokenRefreshFailed(true); // Clear cache for auth failures
      throw new Error('Refresh token expired');
    }

    // Unknown error after max retries - trigger logout without clearing cache
    logger.error('Max token refresh retries exceeded for unknown error, triggering session expiry');
    state.tokenRefreshFailed(false); // Don't clear cache for unknown errors
    throw error;
  }
};

export const attemptTokenRefresh = (operation: any, forward: any): Observable<any> => {
  return new Observable(observer => {
    // If already refreshing, join the existing promise (don't throttle these)
    if (refreshState.isRefreshing && refreshState.refreshPromise) {
      refreshQueue.push((token: string | null) => {
        if (token) {
          operation.setContext({
            headers: { ...operation.getContext().headers, authorization: `Bearer ${token}` },
          });
          forward(operation).subscribe(observer);
        } else {
          observer.error(new Error('Token refresh failed'));
        }
      });
      return;
    }

    // Check if we can attempt a NEW refresh
    if (!canAttemptRefresh()) {
      observer.error(new Error('Token refresh not allowed: rate limited or max retries exceeded'));
      return;
    }

    // Start new refresh process
    refreshState.isRefreshing = true;
    refreshState.refreshPromise = performTokenRefresh();

    refreshState.refreshPromise
      .then(newToken => {
        processQueue(newToken);
        if (newToken) {
          operation.setContext({
            headers: { ...operation.getContext().headers, authorization: `Bearer ${newToken}` },
          });
          forward(operation).subscribe(observer);
        } else {
          observer.error(new Error('Token refresh returned null token'));
        }
      })
      .catch(error => {
        processQueue(null);
        observer.error(error);
      })
      .finally(() => {
        resetRefreshState();
      });
  });
};

// Export for testing and monitoring
export const getRefreshState = () => ({ ...refreshState });

// Export for manual refresh state reset (useful for logout)
export const clearRefreshState = () => {
  resetRefreshState();
  refreshQueue = [];
};

/**
 * Check if a refresh token is still valid (not expired)
 * Useful for pre-request validation to avoid wasted API calls
 */
export const isRefreshTokenValid = (refreshToken: string | null): boolean => {
  if (!refreshToken) return false;
  try {
    const decoded = jwtDecode<{ exp: number }>(refreshToken);
    return Date.now() < decoded.exp * 1000;
  } catch {
    return false;
  }
};

/**
 * Proactive token refresh - called by scheduler before token expires
 * This is the recommended approach to prevent user-facing 401 errors
 *
 * Benefits over reactive refresh:
 * - Zero user-facing errors (refresh before expiration)
 * - Smoother UX (no momentary failures or loading states)
 * - Fewer concurrent refresh requests (scheduled instead of burst on expiration)
 * - Cleaner logs (no expected 401 errors)
 *
 * Fallback: If this fails, reactive refresh (errorLink) will still handle
 * token expiration when the next request fails with 401
 *
 * @returns The new access token on success, null on failure
 */
export const proactiveTokenRefresh = async (): Promise<string | null> => {
  logger.info('[ProactiveRefresh] Starting proactive token refresh');

  // Check if already refreshing (shouldn't happen with proactive, but safety check)
  if (refreshState.isRefreshing && refreshState.refreshPromise) {
    logger.info('[ProactiveRefresh] Already refreshing, returning existing promise');
    return refreshState.refreshPromise;
  }

  // Start refresh process
  refreshState.isRefreshing = true;
  refreshState.refreshPromise = performTokenRefresh();

  try {
    const newToken = await refreshState.refreshPromise;
    processQueue(newToken);
    logger.info('[ProactiveRefresh] Successfully completed');
    return newToken;
  } catch (error) {
    processQueue(null);
    logger.error('[ProactiveRefresh] Failed:', error);
    // Don't rethrow - reactive refresh will handle it if needed
    return null;
  } finally {
    resetRefreshState();
  }
};