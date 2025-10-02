import { Observable } from '@apollo/client';
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
      console.error('Error processing refresh queue callback:', error);
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
    console.warn('Token refresh attempted too soon, throttling');
    return false;
  }

  // Check retry limit
  if (refreshState.retryCount >= REFRESH_CONFIG.MAX_RETRIES) {
    console.error('Max token refresh retries exceeded');
    return false;
  }

  return true;
};

const calculateRetryDelay = (retryCount: number): number => {
  return REFRESH_CONFIG.RETRY_DELAY_BASE * Math.pow(REFRESH_CONFIG.BACKOFF_MULTIPLIER, retryCount);
};

const performTokenRefresh = async (): Promise<string | null> => {
  const state = useStore.getState();
  const refreshToken = state.refreshToken;

  if (!refreshToken) {
    console.error('Token refresh failed: No refresh token available');
    state.tokenRefreshFailed();
    throw new Error('No refresh token available');
  }

  refreshState.lastRefreshTime = Date.now();
  refreshState.retryCount++;

  try {
    console.log(`Attempting token refresh (attempt ${refreshState.retryCount}/${REFRESH_CONFIG.MAX_RETRIES})`);

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
        console.warn('WebSocket reconnection failed:', wsError);
        // Don't fail the entire refresh for WebSocket issues
      }
    }

    // Reset retry count on successful refresh
    refreshState.retryCount = 0;
    console.log('Token refresh successful');

    return newToken;
  } catch (error: any) {
    console.error(`Token refresh failed (attempt ${refreshState.retryCount}):`, error);

    // Check if this is a fatal error (refresh token expired)
    const isTokenExpiredError =
      error?.networkError?.statusCode === 401 ||
      error?.graphQLErrors?.some((e: any) =>
        e.extensions?.code === 'UNAUTHENTICATED' ||
        e.message?.toLowerCase().includes('expired')
      );

    if (isTokenExpiredError) {
      console.log('Refresh token expired, triggering logout');
      state.tokenRefreshFailed();
      throw new Error('Refresh token expired');
    }

    // For other errors, we might retry
    if (refreshState.retryCount < REFRESH_CONFIG.MAX_RETRIES) {
      const delay = calculateRetryDelay(refreshState.retryCount - 1);
      console.log(`Will retry token refresh in ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return performTokenRefresh(); // Recursive retry
    }

    // Max retries exceeded
    console.error('Max token refresh retries exceeded, triggering logout');
    state.tokenRefreshFailed();
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