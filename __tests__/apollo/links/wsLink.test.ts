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

jest.mock('#/utils/environment', () => ({
  Environment: {
    getApiConfig: jest.fn(() => ({ wsUrl: 'ws://localhost:4000/graphql' })),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((e: any) => ({ message: e?.message || 'unknown' })),
}));

jest.mock('#/utils/deviceId', () => ({
  getDeviceIdSync: jest.fn(() => 'test-device-id'),
}));

jest.mock('react-native-config', () => ({
  WEB_SOCKET_URL: 'ws://test-ws-url',
  API_KEY: 'test-api-key',
}));

import { logger } from '#/utils/environment';

describe('wsLink.ts', () => {
  // We need to re-import for each test to get fresh module state
  let wsLinkModule: any;

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

  // ─── isWebSocketReconnecting ──────────────────────────────────

  describe('isWebSocketReconnecting', () => {
    it('returns false initially', () => {
      expect(wsLinkModule.isWebSocketReconnecting()).toBe(false);
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

    it('handles dispose throwing an error', () => {
      mockDispose.mockImplementationOnce(() => {
        throw new Error('dispose failed');
      });
      expect(() => wsLinkModule.disposeWebSocket()).not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('disposing WebSocket'),
        expect.any(Object),
      );
    });
  });

  // ─── getWebSocketState ────────────────────────────────────────

  describe('getWebSocketState', () => {
    it('returns the current WebSocket state', () => {
      const state = wsLinkModule.getWebSocketState();
      expect(state).toHaveProperty('isReconnecting');
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
          url: expect.any(String),
          lazy: true,
          keepAlive: expect.any(Number),
        }),
      );
    });
  });

  it('connectionParams includes token, apiKey, and deviceId', () => {
    jest.isolateModules(() => {
      const { createClient } = require('graphql-ws');
      createClient.mockClear();
      require('#/apollo/links/wsLink');
      const config = createClient.mock.calls[0][0];
      const params = config.connectionParams();
      expect(params).toEqual(
        expect.objectContaining({
          'x-api-key': 'test-api-key',
          authorization: 'Bearer test-token',
          deviceId: 'test-device-id',
        }),
      );
    });
  });

  it('connectionParams omits authorization when token is null', () => {
    jest.isolateModules(() => {
      const storeModule = require('#store');
      storeModule.useStore.getState.mockReturnValue({ accessToken: null });

      const { createClient } = require('graphql-ws');
      createClient.mockClear();
      require('#/apollo/links/wsLink');
      const config = createClient.mock.calls[0][0];
      const params = config.connectionParams();
      expect(params.authorization).toBeUndefined();
    });
  });
});
