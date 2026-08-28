'use no memo';

// Must mock graphql-ws BEFORE importing the module
const mockTerminate = jest.fn();
const mockDispose = jest.fn();
const mockOn = jest.fn();
const mockSubscribe = jest.fn();

jest.mock('graphql-ws', () => ({
  createClient: jest.fn(() => ({
    on: mockOn,
    subscribe: mockSubscribe,
    dispose: mockDispose,
    terminate: mockTerminate,
  })),
}));

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      accessToken: 'test-token',
    })),
  },
}));

// Environment is auto-mocked via jest.setup.js. Override `getApiConfig` for
// the WS link's URL lookup.
import { Environment } from '#/utils/environment';
beforeAll(() => {
  (Environment.getApiConfig as jest.Mock).mockReturnValue({
    wsUrl: 'ws://localhost:4000/graphql',
  });
});

jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((e: { message?: string } | null | undefined) => ({
    message: e?.message || 'unknown',
  })),
}));

jest.mock('#/utils/deviceId', () => ({
  getDeviceId: jest.fn(() => 'test-device-id'),
  getDeviceIdSync: jest.fn(() => 'test-device-id'),
}));

jest.mock('#/config/env', () => ({
  env: { WEB_SOCKET_URL: 'ws://test-ws-url', API_KEY: 'test-api-key' },
}));

import { logger } from '#/utils/environment';

describe('wsLink.ts', () => {
  // We need to re-import for each test to get fresh module state
  let wsLinkModule: typeof import('#/apollo/links/wsLink');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Reset module state for each test
    jest.isolateModules(() => {
      wsLinkModule = require('#/apollo/links/wsLink');
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── wsLink export ────────────────────────────────────────────

  describe('wsLink export', () => {
    it('exports a wsLink', () => {
      expect(wsLinkModule.wsLink).toBeDefined();
    });
  });

  // ─── reconnectWebSocket ───────────────────────────────────────

  describe('reconnectWebSocket', () => {
    it('calls terminate on the WebSocket client', () => {
      wsLinkModule.reconnectWebSocket();
      expect(mockTerminate).toHaveBeenCalled();
    });

    it('debounces rapid reconnection attempts', () => {
      wsLinkModule.reconnectWebSocket();
      wsLinkModule.reconnectWebSocket(); // Should be debounced
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('debounced'),
      );
    });

    it('handles terminate throwing an error', () => {
      mockTerminate.mockImplementationOnce(() => {
        throw new Error('terminate failed');
      });
      expect(() => wsLinkModule.reconnectWebSocket()).not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('reconnection failed'),
        expect.any(Object),
      );
    });
  });

  // ─── disableAutoReconnect / enableAutoReconnect ───────────────

  describe('disableAutoReconnect', () => {
    it('disables auto reconnect', () => {
      wsLinkModule.disableAutoReconnect();
      // After disabling, reconnect attempts should not schedule
      // We verify this by checking it doesn't throw
      expect(() => wsLinkModule.disableAutoReconnect()).not.toThrow();
    });
  });

  describe('enableAutoReconnect', () => {
    it('enables auto reconnect', () => {
      wsLinkModule.disableAutoReconnect();
      wsLinkModule.enableAutoReconnect();
      // Should not throw
      expect(() => wsLinkModule.enableAutoReconnect()).not.toThrow();
    });
  });

  // ─── disposeWebSocket ─────────────────────────────────────────

  describe('disposeWebSocket', () => {
    it('calls dispose on the client and disables auto-reconnect', () => {
      wsLinkModule.disposeWebSocket();
      expect(mockDispose).toHaveBeenCalled();
    });

    it('handles dispose throwing synchronously', async () => {
      mockDispose.mockImplementationOnce(() => {
        throw new Error('dispose failed');
      });
      expect(() => wsLinkModule.disposeWebSocket()).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('dispose failed'),
        expect.any(Object),
      );
    });

    // The real production failure. graphql-ws's `dispose()` is async and awaits
    // its internal `connecting` promise, which the library rejects with the RAW
    // WebSocket event — a bare `Event` on a failed upgrade, a `CloseEvent` on a
    // close. Neither has a `message`, so an escaped one surfaced as
    // "Unhandled Promise Rejection: Unknown error (Event; props: …)" with the
    // close code stranded. A synchronous try/catch could never see it: the
    // promise leaves the frame the moment dispose() returns.
    it('owns the rejection when dispose() rejects', async () => {
      // Stands in for RN's `new Event('error')`: no `message`, which is why an
      // escaped one logged as "Unknown error (Event; props: …)".
      const rawEvent = { _type: 'error', _defaultPrevented: false };
      mockDispose.mockImplementationOnce(() => Promise.reject(rawEvent));

      expect(() => wsLinkModule.disposeWebSocket()).not.toThrow();

      // Flush the microtask queue. A `.catch` having run is precisely what
      // stops Hermes' tracker reporting this as unhandled — asserting the log
      // is asserting that the handler is attached.
      await Promise.resolve();
      await Promise.resolve();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('dispose failed'),
        expect.any(Object),
      );
    });

    it('still drops the client reference when dispose() rejects', async () => {
      mockDispose.mockImplementationOnce(() =>
        Promise.reject({ _type: 'close' }),
      );
      wsLinkModule.disposeWebSocket();
      await Promise.resolve();
      // A disposed graphql-ws client is one-way, so the reference must go
      // whatever dispose does — otherwise the next sign-in gets a socket that
      // connects once and then goes quiet.
      expect(wsLinkModule.getWebSocketState().hasClient).toBe(false);
    });
  });

  // ─── getWebSocketState ────────────────────────────────────────

  describe('getWebSocketState', () => {
    it('returns the current WebSocket state', () => {
      const state = wsLinkModule.getWebSocketState();
      expect(state).toHaveProperty('lastReconnectTime');
      expect(state).toHaveProperty('hasClient');
      expect(state.hasClient).toBe(true);
    });
  });
});

// Test the createWsClient connectionParams and event handlers separately
describe('wsLink createClient config', () => {
  it('creates client with correct configuration via createClient', () => {
    jest.isolateModules(() => {
      const { createClient } = require('graphql-ws');
      // Clear any previous calls, then re-import to trigger createClient
      createClient.mockClear();
      require('#/apollo/links/wsLink');
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          // A function, not a string: graphql-ws awaits `url` before every
          // dial, which is where the backoff and offline gate live — it is the
          // only hook every dial passes through (see wsCloseCodes.library.test).
          url: expect.any(Function),
          lazy: true,
          keepAlive: expect.any(Number),
          shouldRetry: expect.any(Function),
          retryAttempts: Infinity,
        }),
      );
    });
  });

  const loadConnectionParams = (): (() => Record<
    string,
    string | undefined
  >) => {
    let connectionParams!: () => Record<string, string | undefined>;
    jest.isolateModules(() => {
      const { createClient } = require('graphql-ws');
      createClient.mockClear();
      require('#/apollo/links/wsLink');
      connectionParams = createClient.mock.calls[0][0].connectionParams;
    });
    return connectionParams;
  };

  it('connectionParams includes token, apiKey, and deviceId', () => {
    expect(loadConnectionParams()()).toEqual(
      expect.objectContaining({
        'x-api-key': 'test-api-key',
        authorization: 'Bearer test-token',
        deviceId: 'test-device-id',
      }),
    );
  });

  it('connectionParams omits authorization when token is null', () => {
    const storeModule = require('#store');
    storeModule.useStore.getState.mockReturnValue({ accessToken: null });

    expect(loadConnectionParams()().authorization).toBeUndefined();
  });
});
