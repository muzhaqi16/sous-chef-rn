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

export const wsLink = new GraphQLWsLink(
  createClient({
    url: Config.WEB_SOCKET_URL || 'ws://localhost:4000/graphql',
    webSocketImpl, // ← critical for RN
    lazy: true, // only connect on first subscribe
    keepAlive: 12_000, // send ping every 12s to keep alive
    connectionParams: () => {
      const token = useStore.getState().accessToken;
      return token ? {authorization: `Bearer ${token}`} : {};
    },
    on: {
      connected: () => console.log('[WS] connected'),
      closed: () => console.log('[WS] closed'),
      error: err => console.warn('[WS] error', err),
    },
  }),
);
