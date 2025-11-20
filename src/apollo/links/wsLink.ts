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
    // Don't throw - allow app to continue with degraded functionality (no real-time updates)
  }
};

// Export state checkers for other modules
export const isWebSocketReconnecting = () => isReconnecting;

// Export function to dispose WebSocket for logout cleanup
export const disposeWebSocket = () => {
  try {
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
