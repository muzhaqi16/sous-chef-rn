import {GraphQLWsLink} from '@apollo/client/link/subscriptions';
import {createClient, Client} from 'graphql-ws';
import {Platform} from 'react-native';
import Config from 'react-native-config';
import {useStore} from '#store';

// pick the right WebSocket constructor
const webSocketImpl =
  Platform.OS === 'web'
    ? WebSocket // for RN-Web
    : global.WebSocket; // for iOS & Android

// Environment-based WebSocket URL with fallbacks
const getWebSocketUrl = () => {
  if (Config.WEB_SOCKET_URL) {
    return Config.WEB_SOCKET_URL;
  }

  // Fallback based on __DEV__ flag
  if (__DEV__) {
    return 'ws://localhost:4000/graphql';
  } else {
    // Production fallback
    return 'wss://api.souschef.com/graphql';
  }
};

const WS_URL = getWebSocketUrl();

// Store the client instance so we can reconnect it
let wsClient: Client;

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

      console.log('[WS] connectionParams called with token:', token ? 'present' : 'missing');
      return params;
    },
    on: {
      connected: () => console.log('[WS] connected'),
      closed: () => console.log('[WS] closed'),
      error: err => console.warn('[WS] error', err),
    },
  });
};

// Initialize the client
wsClient = createWsClient();

export const wsLink = new GraphQLWsLink(wsClient);

// Function to reconnect WebSocket with new token
export const reconnectWebSocket = () => {
  console.log('[WS] Reconnecting with new token...');

  // Dispose the old client
  wsClient.dispose();

  // Create a new client (this will call connectionParams with the new token)
  wsClient = createWsClient();

  // Update the wsLink to use the new client
  // Note: GraphQLWsLink doesn't have a public method to update the client,
  // so we need to access the private property
  (wsLink as any).client = wsClient;

  console.log('[WS] WebSocket reconnection initiated');
};
