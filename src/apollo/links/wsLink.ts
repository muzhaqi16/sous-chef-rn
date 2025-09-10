import {GraphQLWsLink} from '@apollo/client/link/subscriptions';
import {createClient} from 'graphql-ws';
import {Platform} from 'react-native';
import {useStore} from '../../store';

// pick the right WebSocket constructor
const webSocketImpl =
  Platform.OS === 'web'
    ? WebSocket // for RN-Web
    : global.WebSocket; // for iOS & Android

// Environment-based WebSocket URL with fallbacks
const getWebSocketUrl = () => {
  if (process.env.WEB_SOCKET_URL) {
    return process.env.WEB_SOCKET_URL;
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

export const wsLink = new GraphQLWsLink(
  createClient({
    url: WS_URL,
    webSocketImpl, // ← critical for RN
    lazy: true, // only connect on first subscribe
    keepAlive: 12_000, // send ping every 12s to keep alive
    connectionParams: () => {
      const token = useStore.getState().accessToken;
      const apiKey = process.env.API_KEY;

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
