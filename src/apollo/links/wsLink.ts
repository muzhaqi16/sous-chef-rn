import {GraphQLWsLink} from '@apollo/client/link/subscriptions';
import {createClient} from 'graphql-ws';
import Config from 'react-native-config';
import {useStore} from '../../store';

export const wsLink = new GraphQLWsLink(
  createClient({
    url: Config.WEB_SOCKET_URL || 'ws://localhost:4000/graphql',
    connectionParams: () => {
      const token = useStore.getState().accessToken;
      return token ? {authorization: `Bearer ${token}`} : {};
    },
  }),
);
