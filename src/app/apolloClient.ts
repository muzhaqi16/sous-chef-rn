import { createApolloClient } from '#/apollo/client';
import { createNativeWebSocketTransport } from '#native/webSocketTransport';

/** The app's Apollo client, built when this module first loads. */
export const client = createApolloClient({
  webSocket: createNativeWebSocketTransport(),
});
