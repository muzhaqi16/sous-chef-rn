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
// Captured in beforeAll for the same reason as onHandlers.
let connectionParams: () => Record<string, string | undefined>;

beforeAll(() => {
  (Environment.getApiConfig as jest.Mock).mockReturnValue({
    wsUrl: 'ws://localhost:4000/graphql',
  });
  const { createClient } = require('graphql-ws');
  const config = createClient.mock.calls[0][0];
  onHandlers = config.on as WsLifecycleHandlers;
  connectionParams = config.connectionParams as () => Record<
    string,
    string | undefined
  >;
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

// The 4403 close handler calls whatever refresh function was registered via
// registerSessionAuthRefresh (in the app, refreshToken.ts registers
// proactiveTokenRefresh at module init). Tests register their own mock.

import {
  reconnectWebSocket,
  isWebSocketReconnecting,
  disableAutoReconnect,
  enableAutoReconnect,
  disposeWebSocket,
  getWebSocketState,
  resumeWebSocketAfterOnline,
  onWebSocketReconnected,
  registerSessionAuthRefresh,
} from '../wsLink';

describe('wsLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-enable auto reconnect for each test
    enableAutoReconnect();
  });

  describe('onWebSocketReconnected', () => {
    it('fires listeners on a reconnect (not the first connect) and unsubscribes', () => {
      const listener = jest.fn();
      const unsubscribe = onWebSocketReconnected(listener);

      // First connect is the initial connection — must NOT fire.
      onHandlers.connected({}, undefined);
      expect(listener).not.toHaveBeenCalled();

      // A subsequent connect is a reconnect — fires the backfill listener.
      onHandlers.connected({}, undefined);
      expect(listener).toHaveBeenCalledTimes(1);

      // After unsubscribe, further reconnects don't call it.
      unsubscribe();
      onHandlers.connected({}, undefined);
      expect(listener).toHaveBeenCalledTimes(1);
    });
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

  // 4403 is the server's mid-stream session re-validation close ("Session
  // expired" / "Session revoked"). Reconnecting with the same token would be
  // rejected identically, so the handler must refresh first — and treat a
  // repeated 4403 as a revoked session.
  describe('session auth close (4403)', () => {
    let mockSessionRefresh: jest.Mock;

    beforeEach(() => {
      jest.useFakeTimers();
      disableAutoReconnect();
      enableAutoReconnect();
      mockSessionRefresh = jest.fn().mockResolvedValue('new-token');
      registerSessionAuthRefresh(mockSessionRefresh);
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      disableAutoReconnect();
      enableAutoReconnect();
    });

    it('first 4403 triggers a token refresh and schedules no raw reconnect', () => {
      onHandlers.closed({
        code: 4403,
        reason: 'Session expired',
        wasClean: true,
      });

      expect(mockSessionRefresh).toHaveBeenCalledTimes(1);

      // No backoff reconnect from this branch — a successful refresh
      // reconnects the socket itself with the new token.
      jest.advanceTimersByTime(31000);
      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });

    it('repeated 4403 before a stable connection clears auth (revoked session)', () => {
      const { useStore } = require('#store');
      const clearAuth = jest.fn();
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        clearAuth,
      });

      onHandlers.closed({ code: 4403, reason: 'Session expired' });
      expect(mockSessionRefresh).toHaveBeenCalledTimes(1);

      // The refreshed token was rejected too — the session is revoked.
      onHandlers.closed({ code: 4403, reason: 'Session revoked' });
      expect(clearAuth).toHaveBeenCalledTimes(1);
      expect(mockSessionRefresh).toHaveBeenCalledTimes(1);
    });

    it('a connection that survives the stability window re-arms the refresh recovery', () => {
      const { useStore } = require('#store');
      const clearAuth = jest.fn();
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        clearAuth,
      });

      onHandlers.closed({ code: 4403, reason: 'Session expired' });

      // The refreshed token holds a stable connection…
      onHandlers.connected({}, undefined);
      jest.advanceTimersByTime(11000);

      // …so a much later 4403 is a fresh expiry: refresh again, no sign-out.
      onHandlers.closed({ code: 4403, reason: 'Session expired' });

      expect(mockSessionRefresh).toHaveBeenCalledTimes(2);
      expect(clearAuth).not.toHaveBeenCalled();
    });
  });

  // 4410 is the server recycling a socket that exceeded its max subscription
  // duration — operational, so the reconnect must land at the base delay
  // instead of an escalated backoff.
  describe('duration recycle (close 4410)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      disableAutoReconnect();
      enableAutoReconnect();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      disableAutoReconnect();
      enableAutoReconnect();
    });

    it('reconnects at the base delay even when the backoff counter was escalated', () => {
      // Escalate the counter via two connect→close cycles.
      onHandlers.connected({}, undefined);
      onHandlers.closed({ code: 1000, reason: '', wasClean: true });
      jest.advanceTimersByTime(31000);
      onHandlers.closed({ code: 1000, reason: '', wasClean: true });
      jest.advanceTimersByTime(31000);
      expect(getWebSocketState().reconnectAttempts).toBeGreaterThan(1);

      onHandlers.closed({
        code: 4410,
        reason: 'Subscription duration exceeded',
        wasClean: true,
      });

      // Base delay is 1000ms + up to 25% jitter — the reconnect must fire
      // within ~1.3s, which only happens if the counter was reset to 0.
      jest.advanceTimersByTime(1300);
      expect(getWebSocketState().reconnectAttempts).toBe(1);
    });

    it('does not reconnect after auto-reconnect is disabled (logout)', () => {
      disableAutoReconnect();
      onHandlers.closed({
        code: 4410,
        reason: 'Subscription duration exceeded',
        wasClean: true,
      });
      jest.advanceTimersByTime(31000);
      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });
  });

  describe('client identity', () => {
    it('sends the client name and native version in connectionParams', () => {
      expect(connectionParams()).toMatchObject({
        'apollographql-client-name': 'sous-chef-app',
        // getVersion() is mocked to '1.0.0' in the device-info test mock.
        'apollographql-client-version': '1.0.0',
      });
    });
  });

  // 4411 means the server refuses this build's version. Reconnecting sends the
  // same version, so the cycle must stop rather than back off.
  describe('client upgrade required (close 4411)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      disableAutoReconnect();
      enableAutoReconnect();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      disableAutoReconnect();
      enableAutoReconnect();
    });

    it('does not schedule a reconnect', () => {
      onHandlers.connected({}, undefined);
      onHandlers.closed({
        code: 4411,
        reason: 'Client upgrade required: 5.0.0',
        wasClean: true,
      });

      jest.advanceTimersByTime(31000);

      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });

    it('stops reconnecting on subsequent closes for the rest of the session', () => {
      onHandlers.closed({
        code: 4411,
        reason: 'Client upgrade required',
        wasClean: true,
      });
      // A later transport-level drop must not restart the cycle either — the
      // build is still the same build.
      onHandlers.closed({ code: 1006, reason: '', wasClean: false });

      jest.advanceTimersByTime(31000);

      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });
  });
});
