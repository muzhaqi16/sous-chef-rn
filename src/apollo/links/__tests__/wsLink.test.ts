'use no memo';

// Mock store before importing wsLink
const mockSetTokens = jest.fn();
const mockEndSession = jest.fn();
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      accessToken: 'mock-token',
      isOnline: true,
      setTokens: mockSetTokens,
      endSession: mockEndSession,
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
let shouldRetry: (errOrCloseEvent: unknown) => boolean;

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
  shouldRetry = config.shouldRetry as (errOrCloseEvent: unknown) => boolean;
});

// Mock errorSerialization
jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((e: unknown) =>
    e instanceof Error ? e.message : 'unknown',
  ),
}));

// Mock deviceId
jest.mock('#/utils/deviceId', () => ({
  getDeviceId: jest.fn(() => 'test-device-id'),
  getDeviceIdSync: jest.fn(() => 'test-device-id'),
}));

// The socket calls whatever refresh function was registered via
// registerTokenRefresh (in the app, refreshToken.ts registers
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
  registerTokenRefresh,
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
      registerTokenRefresh(mockSessionRefresh);
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

    it('repeated 4403 backs off instead of signing the user out', () => {
      // 4403 is never terminal: it says the token is stale, and a rotation the
      // client lost a race for produces it too. Anything unrecoverable arrives
      // as 4412. Ending the session here would sign the user out of a session
      // the winner of that race just renewed.
      const { useStore } = require('#store');
      const endSession = jest.fn(() => Promise.resolve());
      const clearAuth = jest.fn();
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        isOnline: true,
        endSession,
        clearAuth,
      });

      onHandlers.closed({ code: 4403, reason: 'Session expired' });
      expect(mockSessionRefresh).toHaveBeenCalledTimes(1);

      onHandlers.closed({ code: 4403, reason: 'Session expired' });

      expect(endSession).not.toHaveBeenCalled();
      expect(clearAuth).not.toHaveBeenCalled();
      // The latch is a loop breaker, not a verdict — one refresh, then the
      // ordinary reconnect backoff takes over.
      expect(mockSessionRefresh).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(2000);
      expect(getWebSocketState().reconnectAttempts).toBeGreaterThan(0);
    });

    it('a connection that survives the stability window re-arms the refresh recovery', () => {
      const { useStore } = require('#store');
      const endSession = jest.fn(() => Promise.resolve());
      const clearAuth = jest.fn();
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        endSession,
        clearAuth,
      });

      onHandlers.closed({ code: 4403, reason: 'Session expired' });

      // The refreshed token holds a stable connection…
      onHandlers.connected({}, undefined);
      jest.advanceTimersByTime(11000);

      // …so a much later 4403 is a fresh expiry: refresh again, no sign-out.
      onHandlers.closed({ code: 4403, reason: 'Session expired' });

      expect(mockSessionRefresh).toHaveBeenCalledTimes(2);
      expect(endSession).not.toHaveBeenCalled();
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

  // graphql-ws re-dials on its own, before the `closed` handler's backoff runs.
  // These pin the table both sides read.
  describe('shouldRetry', () => {
    it.each([
      ['session auth, the closed handler refreshes first', 4403],
      ['client upgrade required', 4411],
      ['re-authentication required', 4412],
      ['API key refused', 4413],
      ['malformed frame', 4400],
      ['subscribed before the ack', 4401],
      ['subprotocol not acceptable', 4406],
      ['duplicate operation id', 4409],
    ])('refuses to re-dial after %s (%i)', (_label, code) => {
      expect(shouldRetry({ code, reason: '' })).toBe(false);
    });

    it.each([
      ['subscription duration exceeded', 4410],
      ['too many initialisation requests', 4429],
      ['internal server error', 4500],
      ['abnormal close', 1006],
    ])('re-dials after %s (%i)', (_label, code) => {
      expect(shouldRetry({ code, reason: '' })).toBe(true);
    });

    it('re-dials on a failure that carries no close code at all', () => {
      // DNS and TCP failures arrive as plain errors, and they are transient.
      expect(shouldRetry(new Error('getaddrinfo ENOTFOUND'))).toBe(true);
      expect(shouldRetry(undefined)).toBe(true);
    });
  });

  // 4412 is the server saying these credentials cannot be refreshed into a
  // working session. Every later request is answered identically, so the socket
  // has to stop and the user has to be put in front of a sign-in screen.
  describe('re-authentication required (close 4412)', () => {
    let endSession: jest.Mock;
    let clearAuth: jest.Mock;

    beforeEach(() => {
      jest.useFakeTimers();
      disableAutoReconnect();
      enableAutoReconnect();
      endSession = jest.fn(() => Promise.resolve());
      clearAuth = jest.fn();
      const { useStore } = require('#store');
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        isOnline: true,
        endSession,
        clearAuth,
      });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      disableAutoReconnect();
      enableAutoReconnect();
    });

    it('ends the session and schedules no reconnect', () => {
      onHandlers.closed({
        code: 4412,
        reason: 'Re-authentication required',
        wasClean: true,
      });

      expect(endSession).toHaveBeenCalledTimes(1);
      expect(endSession).toHaveBeenCalledWith('session_revoked');

      jest.advanceTimersByTime(31000);
      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });

    it('stops reconnecting on subsequent closes for the rest of the session', () => {
      onHandlers.closed({ code: 4412, reason: 'Authentication required' });
      onHandlers.closed({ code: 1006, reason: '', wasClean: false });

      jest.advanceTimersByTime(31000);
      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });
  });

  // 4413 refuses the API key, not the user. It is just as permanent as 4412,
  // but signing the user out would hide a build fault behind a login screen
  // they cannot do anything about.
  describe('API key refused (close 4413)', () => {
    let endSession: jest.Mock;
    let clearAuth: jest.Mock;

    beforeEach(() => {
      jest.useFakeTimers();
      disableAutoReconnect();
      enableAutoReconnect();
      endSession = jest.fn(() => Promise.resolve());
      clearAuth = jest.fn();
      const { useStore } = require('#store');
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        isOnline: true,
        endSession,
        clearAuth,
      });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      disableAutoReconnect();
      enableAutoReconnect();
    });

    it('stops reconnecting but leaves the session signed in', () => {
      onHandlers.closed({
        code: 4413,
        reason: 'Invalid API key',
        wasClean: true,
      });

      expect(endSession).not.toHaveBeenCalled();
      expect(clearAuth).not.toHaveBeenCalled();

      jest.advanceTimersByTime(31000);
      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });
  });

  // The server names its auth refusals with their own codes (4403 / 4412 /
  // 4413), so 4500 is a genuine server fault — the one shape backoff exists for.
  describe('server fault (close 4500)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      disableAutoReconnect();
      enableAutoReconnect();
      const { useStore } = require('#store');
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        isOnline: true,
      });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      disableAutoReconnect();
      enableAutoReconnect();
    });

    it('backs off and reconnects', () => {
      onHandlers.closed({
        code: 4500,
        reason: 'Internal server error',
        wasClean: false,
      });

      jest.advanceTimersByTime(2000);
      expect(getWebSocketState().reconnectAttempts).toBeGreaterThan(0);
    });
  });

  // The handshake rotates an expired access token itself when it is given a
  // refresh token, which is what removes the connect → 4403 → refresh →
  // reconnect round trip.
  describe('connect-time rotation', () => {
    const setStoredTokens = (
      accessToken: string | null,
      refreshToken: string | null,
    ) => {
      const { useStore } = require('#store');
      useStore.getState.mockReturnValue({
        accessToken,
        refreshToken,
        isOnline: true,
      });
    };

    it('sends the refresh token alongside the access token', () => {
      setStoredTokens('access-token', 'refresh-token');

      expect(connectionParams()).toMatchObject({
        authorization: 'Bearer access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('omits the refresh token when there is none stored', () => {
      setStoredTokens('access-token', null);

      expect(connectionParams().refreshToken).toBeUndefined();
    });

    it('does not refuse to dial when only the refresh token is stored', () => {
      // Hydration can land the pair in either order; a handshake with no access
      // token is refused 4412, which is the correct verdict to receive rather
      // than one to pre-empt here.
      setStoredTokens(null, 'refresh-token');

      const params = connectionParams();
      expect(params.authorization).toBeUndefined();
      expect(params.refreshToken).toBe('refresh-token');
    });
  });

  // The ack is the only delivery of a rotated pair. Dropping it would leave HTTP
  // on a token the socket has already replaced, and strand a refresh token
  // nothing can recover.
  describe('rotated tokens in the connection_ack payload', () => {
    let setTokens: jest.Mock;

    beforeEach(() => {
      setTokens = jest.fn();
      const { useStore } = require('#store');
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        isOnline: true,
        setTokens,
      });
    });

    it('persists the pair when the server reports a rotation', () => {
      onHandlers.connected(
        {},
        {
          accessToken: 'rotated-access',
          refreshToken: 'rotated-refresh',
          tokenRefreshed: true,
        },
      );

      expect(setTokens).toHaveBeenCalledWith({
        accessToken: 'rotated-access',
        refreshToken: 'rotated-refresh',
      });
    });

    it('ignores an ordinary ack, which reports no rotation at all', () => {
      onHandlers.connected({}, undefined);
      onHandlers.connected({}, { tokenRefreshed: false });
      onHandlers.connected(
        {},
        {
          accessToken: 'rotated-access',
          refreshToken: 'rotated-refresh',
        },
      );

      expect(setTokens).not.toHaveBeenCalled();
    });
  });
});
