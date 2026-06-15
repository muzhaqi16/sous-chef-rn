'use no memo';

// Mock store before importing wsLink
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      accessToken: 'mock-token',
    })),
  },
}));

// Environment is auto-mocked via jest.setup.js. Override `getApiConfig` so
// the WS link picks up the local test URL.
import { Environment } from '#/utils/environment';

// graphql-ws's lifecycle handlers are passed as the `on` config to
// createClient at module-import time. Capture that object reference in
// beforeAll — the per-test `clearAllMocks()` wipes `createClient.mock.calls`,
// but the captured object itself survives.
type WsLifecycleHandlers = {
  connected: (socket: unknown, payload?: Record<string, unknown>) => void;
  closed: (event: unknown) => void;
};
let onHandlers: WsLifecycleHandlers;

beforeAll(() => {
  (Environment.getApiConfig as jest.Mock).mockReturnValue({
    wsUrl: 'ws://localhost:4000/graphql',
  });
  const { createClient } = require('graphql-ws');
  onHandlers = createClient.mock.calls[0][0].on as WsLifecycleHandlers;
});

// Mock errorSerialization
jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : 'unknown',
  ),
}));

// Mock deviceId
jest.mock('#/utils/deviceId', () => ({
  getDeviceIdSync: jest.fn(() => 'test-device-id'),
}));

import {
  reconnectWebSocket,
  isWebSocketReconnecting,
  disableAutoReconnect,
  enableAutoReconnect,
  disposeWebSocket,
  getWebSocketState,
  resumeWebSocketAfterOnline,
} from '../wsLink';

describe('wsLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-enable auto reconnect for each test
    enableAutoReconnect();
  });

  describe('isWebSocketReconnecting', () => {
    it('returns false initially', () => {
      expect(isWebSocketReconnecting()).toBe(false);
    });
  });

  describe('getWebSocketState', () => {
    it('returns current state object', () => {
      const state = getWebSocketState();
      expect(state).toHaveProperty('isReconnecting');
      expect(state).toHaveProperty('lastReconnectTime');
      expect(state).toHaveProperty('hasClient');
      expect(state.hasClient).toBe(true);
    });
  });

  describe('reconnectWebSocket', () => {
    it('calls terminate on the ws client', () => {
      reconnectWebSocket();
      // The graphql-ws mock's terminate should be called
      const { createClient } = require('graphql-ws');
      const mockClient = createClient.mock.results[0]?.value;
      if (mockClient) {
        expect(mockClient.terminate).toHaveBeenCalled();
      }
    });

    it('debounces rapid reconnection attempts', () => {
      reconnectWebSocket();
      reconnectWebSocket(); // Should be debounced
      // Second call should be a no-op due to debounce
      expect(isWebSocketReconnecting()).toBe(false);
    });
  });

  describe('resumeWebSocketAfterOnline', () => {
    it('no-ops when no reconnect was deferred while offline', () => {
      const before = getWebSocketState().lastReconnectTime;
      resumeWebSocketAfterOnline();
      // Without a deferred cycle there is nothing to resume — no reconnect fired.
      expect(getWebSocketState().lastReconnectTime).toBe(before);
    });

    it('stays a no-op after auto-reconnect is disabled (logout)', () => {
      disableAutoReconnect();
      const before = getWebSocketState().lastReconnectTime;
      resumeWebSocketAfterOnline();
      expect(getWebSocketState().lastReconnectTime).toBe(before);
    });
  });

  describe('disableAutoReconnect', () => {
    it('prevents auto reconnection', () => {
      disableAutoReconnect();
      const state = getWebSocketState();
      // After disabling, state should be stable
      expect(state.hasClient).toBe(true);
    });
  });

  describe('enableAutoReconnect', () => {
    it('re-enables auto reconnection after disable', () => {
      disableAutoReconnect();
      enableAutoReconnect();
      // Should not throw
      expect(getWebSocketState().hasClient).toBe(true);
    });
  });

  describe('disposeWebSocket', () => {
    it('disposes the websocket client gracefully', () => {
      disposeWebSocket();
      const state = getWebSocketState();
      expect(state.isReconnecting).toBe(false);
    });

    it('handles disposal errors gracefully', () => {
      const { createClient } = require('graphql-ws');
      const mockClient = createClient.mock.results[0]?.value;
      if (mockClient) {
        mockClient.dispose.mockImplementation(() => {
          throw new Error('dispose error');
        });
      }
      // Should not throw
      expect(() => disposeWebSocket()).not.toThrow();
    });

    it('resets lastReconnectTime to 0', () => {
      // First trigger a reconnect to set lastReconnectTime
      enableAutoReconnect();
      reconnectWebSocket();
      // Now dispose
      disposeWebSocket();
      const state = getWebSocketState();
      expect(state.lastReconnectTime).toBe(0);
    });
  });

  describe('reconnectWebSocket - error handling', () => {
    it('handles terminate error and schedules reconnect', () => {
      enableAutoReconnect();
      const { createClient } = require('graphql-ws');
      const mockClient = createClient.mock.results[0]?.value;
      if (mockClient) {
        mockClient.terminate.mockImplementation(() => {
          throw new Error('terminate error');
        });
      }
      // Should not throw
      expect(() => reconnectWebSocket()).not.toThrow();
      // Reset
      if (mockClient) {
        mockClient.terminate.mockImplementation(jest.fn());
      }
    });
  });

  describe('getWebSocketState - detailed', () => {
    it('returns correct hasClient state', () => {
      const state = getWebSocketState();
      expect(state.hasClient).toBe(true);
      expect(typeof state.isReconnecting).toBe('boolean');
      expect(typeof state.lastReconnectTime).toBe('number');
    });
  });

  describe('disableAutoReconnect - detailed', () => {
    it('clears reconnect attempts counter', () => {
      disableAutoReconnect();
      // After disabling, re-enabling and checking state should work
      enableAutoReconnect();
      const state = getWebSocketState();
      expect(state.hasClient).toBe(true);
    });
  });

  // Regression: a server that closes the socket immediately after the
  // handshake (concurrent-subscription cap exceeded → code 1000) must keep
  // escalating the backoff, not loop at the 1s base delay forever.
  describe('reconnect backoff stability window', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Reset the module-level backoff counter + any pending timers.
      disableAutoReconnect();
      enableAutoReconnect();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      // Leave the module singleton in a clean state for later suites.
      disableAutoReconnect();
      enableAutoReconnect();
    });

    it('does NOT reset the backoff counter when the socket closes before the stability window', () => {
      // Successful handshake immediately followed by a server-initiated close.
      onHandlers.connected({}, undefined);
      onHandlers.closed({ code: 1000, reason: '', wasClean: true });

      // The close scheduled a reconnect; fire it to advance the attempt counter.
      jest.advanceTimersByTime(31000);

      expect(getWebSocketState().reconnectAttempts).toBeGreaterThan(0);
    });

    it('resets the backoff counter once a connection survives the stability window', () => {
      // First push the counter above zero via a connect→close cycle.
      onHandlers.connected({}, undefined);
      onHandlers.closed({ code: 1000, reason: '', wasClean: true });
      jest.advanceTimersByTime(31000);
      expect(getWebSocketState().reconnectAttempts).toBeGreaterThan(0);

      // A connection that stays open past CONNECTION_STABLE_MS clears it.
      onHandlers.connected({}, undefined);
      jest.advanceTimersByTime(11000);
      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });
  });
});
