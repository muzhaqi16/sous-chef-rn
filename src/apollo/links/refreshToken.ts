import { Observable, type ApolloClient } from '@apollo/client';
import type { ApolloLink } from '@apollo/client/link';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { jwtDecode } from 'jwt-decode';
import { logger } from '#/utils/environment';
import { isNetworkError } from '#/utils/isNetworkError';
import { useStore } from '#store';
import { RefreshTokenDocument } from '#operations/auth/auth.generated';
import {
  reconnectWebSocket,
  isWebSocketReconnecting,
  registerSessionAuthRefresh,
} from './wsLink';

// The Apollo client singleton is injected after creation rather than imported
// directly, which would form a circular dependency:
// client → links/index → errorLink → refreshToken → client. `client.ts` calls
// registerApolloClient() once the client exists; the refresh mutation reads the
// reference at call time, by which point it is always set.
let apolloClient: ApolloClient | null = null;

export const registerApolloClient = (clientInstance: ApolloClient): void => {
  apolloClient = clientInstance;
};

// Shape of the error thrown by the refresh mutation that the reactive logic
// inspects. All fields are optional — reads are individually guarded.
interface RefreshErrorLike {
  message?: string;
  networkError?: { statusCode?: number } | null;
  graphQLErrors?: ReadonlyArray<{
    extensions?: { code?: string };
    message?: string;
  }>;
}

// A genuine, server-confirmed refresh-token rejection (vs a network failure,
// which is handled separately and must preserve the cache). Checked only AFTER
// isNetworkError, so transient/offline failures never reach here. Recognizes
// AC4 error types (CombinedGraphQLErrors / ServerError) and falls back to the
// legacy AC3-style shape.
const isAuthRejectionError = (error: unknown): boolean => {
  if (ServerError.is(error)) {
    return error.statusCode === 401;
  }
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.some(
      e =>
        e.extensions?.code === 'UNAUTHENTICATED' ||
        e.extensions?.code === 'AUTH_TOKEN_EXPIRED' ||
        (e.message ?? '').toLowerCase().includes('expired'),
    );
  }
  const legacy = error as RefreshErrorLike;
  return (
    legacy.networkError?.statusCode === 401 ||
    (legacy.graphQLErrors?.some(
      e =>
        e.extensions?.code === 'UNAUTHENTICATED' ||
        e.extensions?.code === 'AUTH_TOKEN_EXPIRED' ||
        (e.message ?? '').toLowerCase().includes('expired'),
    ) ??
      false)
  );
};

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
    // Preserve lastRefreshTime so MIN_REFRESH_INTERVAL throttles across refresh
    // cycles. Logout clears it via clearRefreshState().
    lastRefreshTime: refreshState.lastRefreshTime,
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
  return (
    REFRESH_CONFIG.RETRY_DELAY_BASE *
    Math.pow(REFRESH_CONFIG.BACKOFF_MULTIPLIER, retryCount)
  );
};

const performTokenRefresh = async (): Promise<string | null> => {
  const state = useStore.getState();
  const refreshToken = state.refreshToken;

  if (!refreshToken) {
    logger.error('Token refresh failed: No refresh token available');
    state.setNeedsTokenRefresh(true);
    throw new Error('No refresh token available');
  }

  refreshState.lastRefreshTime = Date.now();
  refreshState.retryCount++;

  try {
    logger.info(
      `Attempting token refresh (attempt ${refreshState.retryCount}/${REFRESH_CONFIG.MAX_RETRIES})`,
    );

    if (!apolloClient) {
      throw new Error('Apollo client not registered for token refresh');
    }

    const response = await apolloClient.mutate({
      mutation: RefreshTokenDocument,
      variables: { input: { token: refreshToken } },
      // 'none' (not the global 'all') so the mutation REJECTS on error and the
      // catch below can classify it. Under 'all', errors resolve into
      // response.error and the generic "Missing tokens" throw loses the real
      // error, collapsing every failure (including genuine 401s) into 'unknown'
      // and never logging the user out on a real rejection.
      errorPolicy: 'none',
      context: { skipErrorLink: true },
    });

    const data = response.data?.refresh;
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
  } catch (error) {
    logger.error(
      `Token refresh failed (attempt ${refreshState.retryCount}):`,
      error,
    );

    // Legacy AC3-style error shape the reactive refresh logic inspects.
    const refreshError = error as RefreshErrorLike;

    // IMPORTANT: Check network errors FIRST before auth errors
    // This prevents offline scenarios from incorrectly clearing the cache
    const isNetworkFailure = isNetworkError(error);

    if (isNetworkFailure) {
      logger.warn(
        `Token refresh failed due to network error (attempt ${refreshState.retryCount}/${REFRESH_CONFIG.MAX_RETRIES}), cache will be preserved:`,
        refreshError.message,
      );

      // For network errors, we retry but DON'T trigger logout after max retries
      if (refreshState.retryCount < REFRESH_CONFIG.MAX_RETRIES) {
        const delay = calculateRetryDelay(refreshState.retryCount - 1);
        logger.info(`Will retry token refresh in ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return performTokenRefresh(); // Recursive retry
      }

      // Max retries exceeded - preserve cache, don't logout
      logger.warn(
        'Token refresh failed due to network error after max retries, preserving cache for offline usage',
      );
      throw error; // Just fail the operation, don't trigger session expiry
    }

    // ONLY check for auth errors if NOT a network error
    if (isAuthRejectionError(error)) {
      logger.info(
        'Refresh token expired (genuine auth error), triggering logout with cache clear',
      );
      state.tokenRefreshFailed('auth_rejected');
      throw new Error('Refresh token expired');
    }

    // Unknown error after max retries — preserve auth state, defer refresh
    logger.error(
      'Max token refresh retries exceeded for unknown error, deferring token refresh',
    );
    state.tokenRefreshFailed('unknown');
    throw error;
  }
};

export const attemptTokenRefresh = (
  operation: ApolloLink.Operation,
  forward: ApolloLink.ForwardFunction,
): Observable<ApolloLink.Result> => {
  return new Observable<ApolloLink.Result>(observer => {
    // If already refreshing, join the existing promise (don't throttle these)
    if (refreshState.isRefreshing && refreshState.refreshPromise) {
      refreshQueue.push((token: string | null) => {
        if (token) {
          operation.setContext({
            headers: {
              ...operation.getContext().headers,
              authorization: `Bearer ${token}`,
            },
          });
          forward(operation).subscribe(observer);
        } else {
          observer.error(new Error('Token refresh failed'));
        }
      });
      return;
    }

    // Within MIN_REFRESH_INTERVAL (or retry budget exhausted): give the
    // operation one more pass with skipErrorLink instead of starting another
    // refresh. authLink attaches the current token on the way down; a repeat
    // 401 then surfaces normally rather than looping back into this link.
    if (!canAttemptRefresh()) {
      operation.setContext({ skipErrorLink: true });
      forward(operation).subscribe(observer);
      return;
    }

    // Start new refresh process
    refreshState.isRefreshing = true;
    refreshState.refreshPromise = performTokenRefresh();

    // Reset state and drain the queue in one synchronous settle handler so a
    // concurrent 401 can't land on an already-drained queue and hang: a late
    // joiner either makes the queue before this runs, or sees isRefreshing
    // cleared and starts its own refresh.
    refreshState.refreshPromise.then(
      newToken => {
        resetRefreshState();
        processQueue(newToken);
        if (newToken) {
          operation.setContext({
            headers: {
              ...operation.getContext().headers,
              authorization: `Bearer ${newToken}`,
            },
          });
          forward(operation).subscribe(observer);
        } else {
          observer.error(new Error('Token refresh returned null token'));
        }
      },
      error => {
        resetRefreshState();
        processQueue(null);
        observer.error(error);
      },
    );
  });
};

// Export for testing and monitoring
export const getRefreshState = () => ({ ...refreshState });

// Full reset for logout: zeroes lastRefreshTime so the next session can refresh
// immediately, and drops any queued joiners.
export const clearRefreshState = () => {
  refreshState = {
    isRefreshing: false,
    refreshPromise: null,
    retryCount: 0,
    lastRefreshTime: 0,
  };
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
    logger.info(
      '[ProactiveRefresh] Already refreshing, returning existing promise',
    );
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

// Hand the WS layer its 4403 (session expired) recovery: refresh the token,
// which on success reconnects the socket itself (performTokenRefresh →
// reconnectWebSocket). Registered here because wsLink cannot import this
// module back without a cycle.
registerSessionAuthRefresh(proactiveTokenRefresh);
