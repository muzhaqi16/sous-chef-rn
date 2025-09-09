import {GraphQLWsLink} from '@apollo/client/link/subscriptions';
import {createClient} from 'graphql-ws';
import {Platform} from 'react-native';
import Config from 'react-native-config';
import {useStore} from '../../store';

// pick the right WebSocket constructor
const webSocketImpl =
  Platform.OS === 'web'
    ? WebSocket // for RN-Web
    : global.WebSocket; // for iOS & Android

// Environment-based WebSocket URL with fallbacks
const getWebSocketUrl = () => {
  // First try react-native-config
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
console.log('WebSocket Link using WS_URL:', WS_URL);

export const wsLink = new GraphQLWsLink(
  createClient({
    url: WS_URL,
    webSocketImpl, // ← critical for RN
    lazy: true, // only connect on first subscribe
    keepAlive: 12_000, // send ping every 12s to keep alive
    connectionParams: () => {
      const token = useStore.getState().accessToken;
      const apiKey = Config.API_KEY;

      if (!apiKey) {
        console.error('[WebSocket] API_KEY is not configured from react-native-config');
      }

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
      connected: () => console.log('[WS] connected'),
      closed: () => console.log('[WS] closed'),
      error: err => console.warn('[WS] error', err),
    },
  }),
);
