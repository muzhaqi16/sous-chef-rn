import { LaunchArguments } from 'react-native-launch-arguments';
import { createNativeWebSocketTransport } from '../webSocketTransport';

jest.mock('#config/env', () => ({ env: { API_KEY: 'client-key' } }));
const mockLanguage = jest.fn(() => 'es');
const mockLanguageListeners: Array<() => void> = [];
jest.mock('#i18n', () => ({
  getResolvedLanguage: () => mockLanguage(),
  onLanguageChanged: (listener: () => void) => {
    mockLanguageListeners.push(listener);
    return () => undefined;
  },
}));
const mockReconnect = jest.fn();
jest.mock('#apollo/links/wsLink', () => ({
  reconnectWebSocket: () => mockReconnect(),
}));
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
beforeEach(() => {
  mockLanguageListeners.length = 0;
  mockLanguage.mockReturnValue('es');
  mockReconnect.mockClear();
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
  it('sends the client key and the language on the upgrade request', () => {
    const { webSocketImpl } = transportFresh()();
    const Impl = webSocketImpl as new (url: string) => unknown;

    const socket = new Impl('wss://api.test/graphql');

    expect(socket).toBeInstanceOf(RecordingWebSocket);
    expect(dialled.at(-1)).toEqual({
      url: 'wss://api.test/graphql',
      options: {
        headers: { 'x-api-key': 'client-key', 'accept-language': 'es' },
      },
    });
  });

  // Events carry names in the socket's language, which only a dial sets.
  it('re-dials on a language switch, and only on a real one', () => {
    const { webSocketImpl } = transportFresh()();
    const Impl = webSocketImpl as new (url: string) => unknown;
    expect(new Impl('wss://api.test/graphql')).toBeInstanceOf(
      RecordingWebSocket,
    );
    const announce = () => {
      for (const listener of mockLanguageListeners) listener();
    };

    announce();
    expect(mockReconnect).not.toHaveBeenCalled();

    mockLanguage.mockReturnValue('it');
    announce();
    expect(mockReconnect).toHaveBeenCalledTimes(1);
  });

  it('pings every 5 minutes under Detox, and leaves the default otherwise', () => {
    expect(createNativeWebSocketTransport().keepAliveMs).toBeUndefined();

    jest
      .mocked(LaunchArguments.value)
      .mockReturnValueOnce({ detoxDisableBackgroundServices: 'true' });

    expect(createNativeWebSocketTransport().keepAliveMs).toBe(300_000);
  });
});
