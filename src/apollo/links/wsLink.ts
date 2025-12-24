import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient, Client } from 'graphql-ws';
import { Platform } from 'react-native';
import Config from 'react-native-config';
import { useStore } from '#store';
import { Environment, logger } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';

// pick the right WebSocket constructor
const webSocketImpl =
  Platform.OS === 'web'
    ? WebSocket // for RN-Web
    : global.WebSocket; // for iOS & Android

// Use Config.WEB_SOCKET_URL from .env if set, otherwise use environment-specific default
const WS_URL = Config.WEB_SOCKET_URL || Environment.getApiConfig().wsUrl;

// Store the client instance so we can reconnect it
let wsClient: Client;
let isReconnecting = false;
let lastReconnectTime = 0;
const RECONNECT_DEBOUNCE_MS = 2000; // 2 seconds debounce for reconnections

// Auto-reconnection state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
let shouldAutoReconnect = true;

/**
 * Calculate reconnection delay with exponential backoff and jitter
 */
const getReconnectDelay = (attempt: number): number => {
  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
    MAX_RECONNECT_DELAY_MS
  );
  // Add jitter (up to 25% variance) to prevent thundering herd
  const jitter = delay * 0.25 * Math.random();
  return delay + jitter;
};

/**
 * Schedule a WebSocket reconnection with exponential backoff
 */
const scheduleReconnect = () => {
  // Clear any pending reconnection
  if (reconnectTimeoutId !== null) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  // Check if we've exceeded max attempts
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('❌ WebSocket max reconnection attempts reached');
    reconnectAttempts = 0;
    return;
  }

  const delay = getReconnectDelay(reconnectAttempts);
  logger.info(`🔄 WebSocket scheduling reconnection in ${Math.round(delay)}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    reconnectAttempts++;
    reconnectWebSocket();
  }, delay);
};

const createWsClient = () => {
  return createClient({
    url: WS_URL,
    webSocketImpl, // ← critical for RN
    lazy: true, // only connect on first subscribe
    keepAlive: 12_000, // send ping every 12s to keep alive
    connectionParams: () => {
      const token = useStore.getState().accessToken;
      const apiKey = Config.API_KEY;

      const params: Record<string, string> = {};

      // Always include API key if available
      if (apiKey) {
        params['x-api-key'] = apiKey;
      }

      // Include authorization only when token is available
      if (token) {
        params.authorization = `Bearer ${token}`;
      }

      return params;
    },
    on: {
      connected: () => {
        isReconnecting = false;
        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;
        if (reconnectTimeoutId !== null) {
          clearTimeout(reconnectTimeoutId);
          reconnectTimeoutId = null;
        }
        if (__DEV__) {
          logger.info('🔌 WebSocket connected:', {
            url: WS_URL,
            timestamp: new Date().toISOString(),
          });
        }
      },
      closed: (event: any) => {
        isReconnecting = false;
        // Error 4500 is "Invalid or expired JWT token" - expected during token expiration
        // Suppress this specific error to reduce log noise during normal token refresh cycles
        const isAuthError = event?.code === 4500;

        if (__DEV__ && !isAuthError) {
          logger.info('🔌 WebSocket closed:', {
            code: event?.code,
            reason: event?.reason,
            wasClean: event?.wasClean,
            timestamp: new Date().toISOString(),
          });
        }

        // Don't reconnect for auth errors (handled by token refresh) or when explicitly disabled
        // Note: Code 1000 can occur when all subscriptions skip (e.g., user deleted last home)
        // In that case we SHOULD reconnect. Logout is handled by disableAutoReconnect() being called first.
        if (isAuthError || !shouldAutoReconnect) {
          return;
        }

        // Schedule automatic reconnection with backoff
        scheduleReconnect();
      },
      error: (error: any) => {
        isReconnecting = false;
        logger.warn('❌ WebSocket error:', {
          error: error?.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      },
      connecting: () => {
        if (__DEV__) {
          logger.info('🔌 WebSocket connecting...', {
            url: WS_URL,
            timestamp: new Date().toISOString(),
          });
        }
      },
      ping: () => {
        if (__DEV__) {
          // logger.info('🏓 WebSocket ping sent');
        }
      },
      pong: () => {
        if (__DEV__) {
          // logger.info('🏓 WebSocket pong received');
        }
      },
    },
  });
};

// Initialize the client
wsClient = createWsClient();

export const wsLink = new GraphQLWsLink(wsClient);

// Function to reconnect WebSocket with new token
export const reconnectWebSocket = () => {
  const now = Date.now();

  // Debounce reconnection attempts
  if (isReconnecting || now - lastReconnectTime < RECONNECT_DEBOUNCE_MS) {
    logger.info('🔌 WebSocket reconnection debounced or already in progress');
    return;
  }

  isReconnecting = true;
  lastReconnectTime = now;

  try {
    logger.info('🔄 WebSocket reconnecting with new token...');

    // Dispose the old client
    if (wsClient) {
      wsClient.dispose();
    }

    // Create a new client (this will call connectionParams with the new token)
    wsClient = createWsClient();

    // Update the wsLink to use the new client
    // Note: GraphQLWsLink doesn't have a public method to update the client.
    // This is a known limitation of the library. The workaround is to access
    // the internal client property. This is safe as long as we handle errors.
    // Alternative: Recreate the entire Apollo Client (too expensive).
    if (wsLink && typeof (wsLink as any).client !== 'undefined') {
      (wsLink as any).client = wsClient;
      logger.info('✅ WebSocket reconnection successful');
      // Reset reconnect attempts on success
      reconnectAttempts = 0;
      if (reconnectTimeoutId !== null) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
    } else {
      throw new Error('Unable to update GraphQLWsLink client - missing client property');
    }

    isReconnecting = false;
  } catch (error) {
    isReconnecting = false;
    logger.error('❌ WebSocket reconnection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    // Schedule another attempt if auto-reconnect is enabled
    if (shouldAutoReconnect) {
      scheduleReconnect();
    }
  }
};

// Export state checkers for other modules
export const isWebSocketReconnecting = () => isReconnecting;

/**
 * Disable automatic WebSocket reconnection.
 * Call this during logout to prevent reconnection attempts.
 */
export const disableAutoReconnect = () => {
  shouldAutoReconnect = false;
  if (reconnectTimeoutId !== null) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  reconnectAttempts = 0;
};

/**
 * Enable automatic WebSocket reconnection.
 * Call this after login to allow reconnection on socket close.
 */
export const enableAutoReconnect = () => {
  shouldAutoReconnect = true;
};

// Export function to dispose WebSocket for logout cleanup
export const disposeWebSocket = () => {
  try {
    // Disable auto-reconnect before disposing
    disableAutoReconnect();
    if (wsClient) {
      logger.info('🔌 Disposing WebSocket client for logout');
      wsClient.dispose();
      isReconnecting = false;
      lastReconnectTime = 0;
    }
  } catch (error) {
    logger.warn('Error disposing WebSocket:', serializeError(error));
  }
};

// Export function to get WebSocket connection state
export const getWebSocketState = () => {
  return {
    isReconnecting,
    lastReconnectTime,
    hasClient: !!wsClient,
  };
};
