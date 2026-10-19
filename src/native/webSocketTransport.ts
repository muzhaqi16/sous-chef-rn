import { LaunchArguments } from 'react-native-launch-arguments';
import type { WebSocketTransport } from '#/apollo/links/wsLink';
import { env } from '#/config/env';

// RN's WebSocket takes a third `options` argument that graphql-ws, which
// constructs the socket as `new Impl(url, protocols)`, never passes.
type WebSocketWithHeaders = new (
  url: string,
  protocols?: string | string[],
  options?: { headers: Record<string, string> },
) => WebSocket;

const NativeWebSocket: WebSocketWithHeaders = global.WebSocket;

/**
 * Under Detox, a ping every 12 s keeps the app from ever reading as idle, so
 * a test run pings every 5 minutes instead.
 */
const detoxKeepAliveMs = (): number | undefined => {
  if (!__DEV__) return undefined;
  try {
    const args = LaunchArguments.value<{
      detoxDisableBackgroundServices?: string;
    }>();
    return args.detoxDisableBackgroundServices ? 300_000 : undefined;
  } catch {
    return undefined;
  }
};

/**
 * React Native's socket, sending the client key on the upgrade REQUEST.
 * `connectionParams` reaches the server only once the socket is open, so a
 * dial an intermediary re-issues without its upgrade headers arrives anonymous
 * and is refused as a scanner.
 */
export function createNativeWebSocketTransport(): WebSocketTransport {
  const upgradeHeaders: Record<string, string> = env.API_KEY
    ? { 'x-api-key': env.API_KEY }
    : {};
  return {
    webSocketImpl: class extends NativeWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols, { headers: upgradeHeaders });
      }
    },
    keepAliveMs: detoxKeepAliveMs(),
  };
}
