import { LaunchArguments } from 'react-native-launch-arguments';
import { createNativeWebSocketTransport } from '../webSocketTransport';

jest.mock('#/config/env', () => ({ env: { API_KEY: 'client-key' } }));
jest.mock('react-native-launch-arguments', () => ({
  LaunchArguments: { value: jest.fn(() => ({})) },
}));

type Dialled = { url: string; options?: { headers: Record<string, string> } };
const dialled: Dialled[] = [];

class RecordingWebSocket {
  constructor(
    url: string,
    _protocols?: string | string[],
    options?: { headers: Record<string, string> },
  ) {
    dialled.push({ url, options });
  }
}

const realWebSocket = global.WebSocket;
beforeAll(() => {
  Object.assign(global, { WebSocket: RecordingWebSocket });
});
afterAll(() => {
  Object.assign(global, { WebSocket: realWebSocket });
});

const transportFresh = (): typeof createNativeWebSocketTransport => {
  let create!: typeof createNativeWebSocketTransport;
  jest.isolateModules(() => {
    ({ createNativeWebSocketTransport: create } =
      require('../webSocketTransport') as typeof import('../webSocketTransport'));
  });
  return create;
};

describe('createNativeWebSocketTransport', () => {
  it('sends the client key on the upgrade request', () => {
    const { webSocketImpl } = transportFresh()();
    const Impl = webSocketImpl as new (url: string) => unknown;

    const socket = new Impl('wss://api.test/graphql');

    expect(socket).toBeInstanceOf(RecordingWebSocket);
    expect(dialled.at(-1)).toEqual({
      url: 'wss://api.test/graphql',
      options: { headers: { 'x-api-key': 'client-key' } },
    });
  });

  it('pings every 5 minutes under Detox, and leaves the default otherwise', () => {
    expect(createNativeWebSocketTransport().keepAliveMs).toBeUndefined();

    jest
      .mocked(LaunchArguments.value)
      .mockReturnValueOnce({ detoxDisableBackgroundServices: 'true' });

    expect(createNativeWebSocketTransport().keepAliveMs).toBe(300_000);
  });
});
