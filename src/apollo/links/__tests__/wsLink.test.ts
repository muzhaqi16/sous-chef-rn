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
// Every dial goes through `url()`, which is where the backoff and the offline
// gate live — `retryWait` is skipped entirely for a close of 1000, so it cannot
// hold the pacing (see wsCloseCodes.library.test.ts). Tests await the gate
// directly rather than advancing a timer this module no longer owns.
let dialGate: () => Promise<string>;

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
  dialGate = config.url as () => Promise<string>;
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

import { isLibraryFatalCloseCode } from '../wsCloseCodes';
import {
  reconnectWebSocket,
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

  describe('getWebSocketState', () => {
    it('returns current state object', () => {
      const state = getWebSocketState();
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

    // Asserted on `lastReconnectTime`, which only moves for a call that was not
    // dropped. This used to read `isWebSocketReconnecting()` — a flag set and
    // cleared inside one synchronous block, so it was `false` whether or not
    // the debounce worked and the assertion could not fail.
    it('debounces rapid reconnection attempts', () => {
      jest.useFakeTimers();
      try {
        // Past any window a previous test left open.
        jest.advanceTimersByTime(5_000);

        reconnectWebSocket();
        const accepted = getWebSocketState().lastReconnectTime;

        reconnectWebSocket(); // Inside the window — dropped.
        expect(getWebSocketState().lastReconnectTime).toBe(accepted);

        jest.advanceTimersByTime(5_000);
        reconnectWebSocket(); // Outside it — accepted.
        expect(getWebSocketState().lastReconnectTime).toBeGreaterThan(accepted);
      } finally {
        jest.useRealTimers();
      }
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
      expect(getWebSocketState().hasClient).toBe(false);
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

  // `dispose()` latches `disposed` inside graphql-ws with no reset, and a
  // disposed client connects once and then silently refuses every retry — no
  // error, no reconnect, nothing logged. So a session end must DROP the client,
  // not keep it. This is reachable from an ordinary sign-out, and from a
  // server-ended session once that runs the same teardown.
  describe('a session end leaves the transport usable for the next sign-in', () => {
    it('builds a new client rather than handing the next session a disposed one', () => {
      const { createClient } = require('graphql-ws');

      enableAutoReconnect();
      const before = createClient.mock.calls.length;

      disposeWebSocket();
      expect(getWebSocketState().hasClient).toBe(false);

      // Signing back in is what calls this.
      enableAutoReconnect();

      expect(getWebSocketState().hasClient).toBe(true);
      expect(createClient.mock.calls.length).toBe(before + 1);
      // And the new session can retry: `shouldRetry` is the only gate, and
      // enabling reconnection re-opens it.
      expect(shouldRetry({ code: 1006, reason: '' })).toBe(true);
    });

    it('drops a client even when disposing it throws', () => {
      const { createClient } = require('graphql-ws');
      // Force a fresh client so its mock is the one this test can reach:
      // `enableAutoReconnect` reuses an existing client without calling
      // createClient, and `clearAllMocks` emptied the recorded results.
      disposeWebSocket();
      enableAutoReconnect();
      const client = createClient.mock.results.at(-1)?.value;
      client.dispose.mockImplementation(() => {
        throw new Error('dispose failed');
      });

      expect(() => disposeWebSocket()).not.toThrow();
      // Keeping it would be the worst outcome: a client that was asked to
      // dispose can only ever be one that refuses to retry.
      expect(getWebSocketState().hasClient).toBe(false);
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

    /** Run the dial gate to completion, counting the dial. */
    const dial = async () => {
      const pending = dialGate();
      await jest.advanceTimersByTimeAsync(31000);
      await pending;
    };

    it('does NOT reset the backoff counter when the socket closes before the stability window', async () => {
      // A handshake the server accepts and then immediately closes — how this
      // server refuses a subscription over the per-user cap.
      await dial();
      onHandlers.connected({}, undefined);
      onHandlers.closed({ code: 1000, reason: '', wasClean: true });
      await dial();
      onHandlers.connected({}, undefined);
      onHandlers.closed({ code: 1000, reason: '', wasClean: true });
      jest.advanceTimersByTime(31000);

      // Each close cancelled the pending reset, so the curve keeps climbing
      // instead of sitting at the 1s base delay forever. graphql-ws's own
      // `retries` would have been reset to 0 by each ack — which is why the
      // count is ours.
      expect(getWebSocketState().reconnectAttempts).toBe(2);
    });

    it('resets the backoff counter once a connection survives the stability window', async () => {
      await dial();
      await dial();
      expect(getWebSocketState().reconnectAttempts).toBe(2);

      // A connection that stays open past CONNECTION_STABLE_MS clears it.
      onHandlers.connected({}, undefined);
      jest.advanceTimersByTime(11000);
      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });
  });

  // `url()` IS the reconnection gate now — graphql-ws awaits it before every
  // dial, which is the only hook that sees all of them. These pin the curve and
  // the offline behaviour.
  describe('dial gate backoff curve', () => {
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

    /** Resolves to the ms elapsed on the fake clock before the gate opened. */
    const timeDial = async (): Promise<number> => {
      let elapsed = -1;
      const start = Date.now();
      const pending = dialGate().then(() => {
        elapsed = Date.now() - start;
      });
      // Step the clock until it opens rather than guessing the exact jitter.
      for (let step = 0; step < 60 && elapsed < 0; step++) {
        await jest.advanceTimersByTimeAsync(1000);
      }
      await pending;
      return elapsed;
    };

    it('does not delay the first dial', async () => {
      // Nothing has failed yet — a cold start must not wait a second.
      expect(await timeDial()).toBe(0);
    });

    it('waits about the base delay on the dial after that', async () => {
      await timeDial();
      const second = await timeDial();
      // 1000ms base + up to 25% jitter.
      expect(second).toBeGreaterThanOrEqual(1000);
      expect(second).toBeLessThanOrEqual(1250);
    });

    it('escalates the wait as unstable dials accumulate', async () => {
      await timeDial();
      const second = await timeDial();
      await timeDial();
      const fourth = await timeDial();

      // 2^2 * 1000 = 4000ms base, so even at minimum jitter it clears the
      // second dial's maximum.
      expect(fourth).toBeGreaterThan(second);
      expect(fourth).toBeGreaterThanOrEqual(4000);
    });

    it('caps the wait so a long outage does not back off forever', async () => {
      for (let i = 0; i < 20; i++) await timeDial();
      const capped = await timeDial();
      // 2^20 seconds uncapped; the ceiling is 30s + jitter.
      expect(capped).toBeLessThanOrEqual(37500);
      expect(capped).toBeGreaterThanOrEqual(30000);
    });

    it('holds the dial while the device is offline, and resumes on reconnect', async () => {
      const { useStore } = require('#store');
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        isOnline: false,
      });

      let opened = false;
      const pending = dialGate().then(() => {
        opened = true;
      });

      // Dialling into an airplane-mode radio re-errors every subscription and
      // wakes the radio for nothing, so the gate does not open on the timer.
      await jest.advanceTimersByTimeAsync(60_000);
      expect(opened).toBe(false);

      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        isOnline: true,
      });
      resumeWebSocketAfterOnline();
      await pending;
      expect(opened).toBe(true);
    });

    // A held dial is ABANDONED on logout, not released. Releasing it resolves
    // `url()`, and graphql-ws constructs the socket on the next line with no
    // `disposed` check — so releasing is dialling, against credentials the
    // server has already refused. Rejecting is worse: that `await` sits in an
    // async IIFE inside a Promise executor, so a rejection is unhandled and
    // leaves `connecting` unsettled forever.
    it('abandons a held dial on logout rather than opening a socket', async () => {
      const { useStore } = require('#store');
      useStore.getState.mockReturnValue({
        accessToken: 'mock-token',
        isOnline: false,
      });

      let opened = false;
      void dialGate().then(() => {
        opened = true;
      });
      await jest.advanceTimersByTimeAsync(60_000);
      expect(opened).toBe(false);

      disableAutoReconnect();

      // Still parked, and it stays parked: nothing dials on the way out.
      await jest.advanceTimersByTimeAsync(60_000);
      expect(opened).toBe(false);

      // And the library's own loop is stopped at the only hook that can stop it.
      expect(shouldRetry({ code: 1006, reason: '' })).toBe(false);
      enableAutoReconnect();
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
      // The latch is a loop breaker on the HTTP fast path, not a verdict: it
      // stops a socket the refresh cannot fix from spending one refresh per
      // close.
      expect(mockSessionRefresh).toHaveBeenCalledTimes(1);
      // Recovery does not depend on that refresh. The close stays retryable,
      // so the library re-dials and connectionParams presents whatever is
      // stored by then — which the server can rotate during the handshake.
      expect(shouldRetry({ code: 4403, reason: 'Session expired' })).toBe(true);
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

    it('reconnects immediately even when the backoff curve was escalated', async () => {
      const dial = async () => {
        const pending = dialGate();
        await jest.advanceTimersByTimeAsync(31000);
        await pending;
      };
      await dial();
      await dial();
      await dial();
      expect(getWebSocketState().reconnectAttempts).toBe(3);

      onHandlers.closed({
        code: 4410,
        reason: 'Subscription duration exceeded',
        wasClean: true,
      });

      // An operational recycle, not a fault: clearing the curve is what makes
      // the next dial immediate rather than an escalated wait.
      expect(getWebSocketState().reconnectAttempts).toBe(0);
    });

    it('does not reconnect after auto-reconnect is disabled (logout)', () => {
      disableAutoReconnect();
      onHandlers.closed({
        code: 4410,
        reason: 'Subscription duration exceeded',
        wasClean: true,
      });
      // `shouldRetry` is the only thing that can stop the library's loop, so
      // that is where logout has to be visible.
      expect(
        shouldRetry({ code: 4410, reason: 'Subscription duration exceeded' }),
      ).toBe(false);
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
      ['a stale access token', 4403],
      ['subscription duration exceeded', 4410],
      ['abnormal close', 1006],
    ])('re-dials after %s (%i)', (_label, code) => {
      expect(shouldRetry({ code, reason: '' })).toBe(true);
    });

    // 4403 gets its own case because returning `false` here is what broke it:
    // the library rethrows a close it will not retry, which errors every active
    // subscription's sink, and nothing in the app re-subscribes. The token is
    // stale, not dead — the re-dial re-runs connectionParams and the server
    // rotates it during the handshake.
    it('re-dials after a stale access token rather than ending the subscriptions', () => {
      expect(shouldRetry({ code: 4403, reason: 'Session expired' })).toBe(true);
    });

    // 4429 and 4500 never reach shouldRetry: graphql-ws rethrows them from
    // shouldRetryConnectOrThrow first. Asserting `true` here described a
    // re-dial that does not happen, so the fact is asserted where it lives.
    it.each([
      ['too many initialisation requests', 4429],
      ['internal server error', 4500],
    ])(
      'records that the library refuses to retry %s (%i) whatever shouldRetry says',
      (_label, code) => {
        expect(isLibraryFatalCloseCode(code)).toBe(true);
      },
    );

    it('does not re-dial once auto-reconnect is disabled', () => {
      disableAutoReconnect();
      expect(shouldRetry({ code: 1006, reason: '' })).toBe(false);
      enableAutoReconnect();
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

    it('leaves the session alone and does not latch reconnection off', () => {
      onHandlers.closed({
        code: 4500,
        reason: 'Internal server error',
        wasClean: false,
      });

      const { useStore } = require('#store');
      expect(useStore.getState().endSession).toBeUndefined();
      // A server fault is not a verdict about this client: nothing here stops
      // future re-dials the way 4411/4412/4413 do.
      expect(shouldRetry({ code: 1006, reason: '' })).toBe(true);
    });

    it('is one the library refuses to retry, so the subscription layer owns recovery', () => {
      // graphql-ws rethrows 4500 from shouldRetryConnectOrThrow before
      // consulting shouldRetry, which errors every active subscription. Only a
      // re-subscribe brings delivery back — see SubscriptionService.
      expect(isLibraryFatalCloseCode(4500)).toBe(true);
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
