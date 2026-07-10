import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient, Client } from 'graphql-ws';
import { Platform } from 'react-native';
import { env } from '#/config/env';
import { useStore } from '#store';
import { Environment, logger } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';
import { getDeviceIdSync } from '#/utils/deviceId';
import { LaunchArguments } from 'react-native-launch-arguments';

// pick the right WebSocket constructor
const webSocketImpl =
  Platform.OS === 'web'
    ? WebSocket // for RN-Web
    : global.WebSocket; // for iOS & Android

// Use env.WEB_SOCKET_URL from .env if set, otherwise use environment-specific default
const WS_URL = env.WEB_SOCKET_URL || Environment.getApiConfig().wsUrl;

// Store the client instance so we can reconnect it
let wsClient: Client;
let isReconnecting = false;
let lastReconnectTime = 0;
const RECONNECT_DEBOUNCE_MS = 2000; // 2 seconds debounce for reconnections

// Reconnect listeners — fired when the socket reconnects after a prior drop, so
// data that may have changed while disconnected (e.g. notifications) can be
// backfilled. First connect does NOT fire (it's not a reconnect).
let hasConnectedBefore = false;
const reconnectListeners = new Set<() => void>();

/** Subscribe to WebSocket reconnects. Returns an unsubscribe fn. */
export function onWebSocketReconnected(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => reconnectListeners.delete(listener);
}

function notifyReconnectListeners(): void {
  reconnectListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // A listener throwing must not break others or the socket lifecycle.
    }
  });
}

// Auto-reconnection state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
let shouldAutoReconnect = true;
// Set when a reconnect was requested while the device was offline — resumed
// by useOnlineQueueSync on the next offline→online transition.
let reconnectDeferredUntilOnline = false;

// A connection is only treated as "healthy" — and the exponential-backoff
// counter reset — once it has stayed open for this long. Critical: when the
// server rejects subscriptions over its concurrent-subscription cap it closes
// the whole socket (code 1000) right after the handshake. Resetting the
// counter on the bare `connected` event lets that connect→close→reconnect
// cycle repeat at the 1s base delay forever (a re-subscribe-everything loop).
// Deferring the reset until the socket proves stable means such a cycle keeps
// escalating the backoff and eventually stops, instead of hammering the server.
const CONNECTION_STABLE_MS = 10_000;
let connectionStableTimeoutId: ReturnType<typeof setTimeout> | null = null;

const clearConnectionStableTimer = () => {
  if (connectionStableTimeoutId !== null) {
    clearTimeout(connectionStableTimeoutId);
    connectionStableTimeoutId = null;
  }
};

/**
 * Calculate reconnection delay with exponential backoff and jitter
 */
const getReconnectDelay = (attempt: number): number => {
  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
    MAX_RECONNECT_DELAY_MS,
  );
  // Add jitter (up to 25% variance) to prevent thundering herd
  const jitter = delay * 0.25 * Math.random();
  return delay + jitter;
};

/**
 * Schedule a WebSocket reconnection with exponential backoff
 */
const scheduleReconnect = () => {
  // Clear any pending reconnection
  if (reconnectTimeoutId !== null) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  // Offline: dialing is pointless — every attempt re-errors all active
  // subscriptions (log churn + radio wakeups). Defer the cycle; the
  // offline→online transition resumes it via resumeWebSocketAfterOnline().
  // Strict `=== false` mirrors isOnline's err-toward-online semantics.
  if (useStore.getState().isOnline === false) {
    if (!reconnectDeferredUntilOnline) {
      reconnectDeferredUntilOnline = true;
      logger.info(
        '🔌 WebSocket reconnect deferred until the device is back online',
      );
    }
    return;
  }

  // Check if we've exceeded max attempts
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('❌ WebSocket max reconnection attempts reached');
    reconnectAttempts = 0;
    return;
  }

  const delay = getReconnectDelay(reconnectAttempts);
  logger.info(
    `🔄 WebSocket scheduling reconnection in ${Math.round(delay)}ms (attempt ${
      reconnectAttempts + 1
    }/${MAX_RECONNECT_ATTEMPTS})`,
  );

  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    reconnectAttempts++;
    reconnectWebSocket();
  }, delay);
};

/**
 * Get the keepAlive interval. In Detox E2E mode, use a long interval (5 min)
 * to prevent frequent pings from blocking Detox idle detection.
 */
const getKeepAliveInterval = (): number => {
  if (__DEV__) {
    try {
      const args = LaunchArguments.value<{
        detoxDisableBackgroundServices?: string;
      }>();
      if (args.detoxDisableBackgroundServices) {
        return 300_000; // 5 minutes — effectively disables pings during tests
      }
    } catch {
      // No launch args available
    }
  }
  return 12_000; // 12 seconds — normal operation
};

const createWsClient = () => {
  return createClient({
    url: WS_URL,
    webSocketImpl, // ← critical for RN
    lazy: true, // only connect on first subscribe
    keepAlive: getKeepAliveInterval(),
    connectionParams: () => {
      const { accessToken: token } = useStore.getState();
      const apiKey = env.API_KEY;
      const deviceId = getDeviceIdSync();

      const params: Record<string, string | undefined> = {};

      // Always include API key if available
      if (apiKey) {
        params['x-api-key'] = apiKey;
      }

      // Include authorization only when token is available
      if (token) {
        params.authorization = `Bearer ${token}`;
      }

      // Refresh-token rotation is single-use and owned solely by the HTTP path
      // (refreshToken.ts). Sending the refresh token here too would race it: the
      // server rotates once and 401s the loser, which the HTTP path treats as a
      // genuine auth failure and logs the user out. The socket carries only the
      // access token and reconnects with a fresh one after an HTTP refresh.

      // Include deviceId for subscription self-echo filtering
      // Server will include this in subscription payloads as originatorClientId
      if (deviceId) {
        params.deviceId = deviceId;
      }

      return params;
    },
    on: {
      connected: () => {
        isReconnecting = false;
        if (reconnectTimeoutId !== null) {
          clearTimeout(reconnectTimeoutId);
          reconnectTimeoutId = null;
        }

        // A connect that follows a previous connection is a reconnect — backfill
        // listeners (notifications, etc.) catch anything missed while dropped.
        if (hasConnectedBefore) {
          notifyReconnectListeners();
        }
        hasConnectedBefore = true;

        // Defer the backoff reset until the connection proves stable. If the
        // server closes the socket before this fires (e.g. concurrent-
        // subscription cap rejection → code 1000), the `closed` handler clears
        // this timer so the counter survives and scheduleReconnect() escalates
        // the backoff instead of looping at the 1s base delay.
        clearConnectionStableTimer();
        connectionStableTimeoutId = setTimeout(() => {
          connectionStableTimeoutId = null;
          reconnectAttempts = 0;
        }, CONNECTION_STABLE_MS);

        if (__DEV__) {
          logger.info('🔌 WebSocket connected:', {
            url: WS_URL,
            timestamp: new Date().toISOString(),
          });
        }
      },
      closed: (event: unknown) => {
        isReconnecting = false;
        // A close before the stability window must NOT reset the backoff
        // counter — clear the pending reset so rapid connect→close cycles
        // (e.g. subscription-cap rejections) escalate the backoff.
        clearConnectionStableTimer();
        const closeEvent =
          event && typeof event === 'object'
            ? (event as { code?: number; reason?: string; wasClean?: boolean })
            : undefined;
        const code = closeEvent?.code;
        const reason =
          typeof closeEvent?.reason === 'string' ? closeEvent.reason : '';

        // Auth error detection: 4500 (legacy), 4401 (new), or 1006+401
        const isAuthCode = code === 4500 || code === 4401;
        const is401Rejection = code === 1006 && reason.includes('401');

        // Specific auth error reasons from server
        const hasAuthReason = [
          'AUTH_TOKEN_EXPIRED',
          'AUTH_REFRESH_TOKEN_INVALID',
          'AUTH_TOKEN_INVALID',
        ].some(r => reason.includes(r));

        if (__DEV__ && !isAuthCode) {
          logger.info('🔌 WebSocket closed:', {
            code,
            reason: closeEvent?.reason,
            wasClean: closeEvent?.wasClean,
            timestamp: new Date().toISOString(),
          });
        }

        // Auth errors — don't reconnect from here. Recovery flows through:
        // authLink detects expired token on next HTTP request →
        // proactiveTokenRefresh() in refreshToken.ts →
        // reconnectWebSocket() in wsLink.ts (one-directional dependency)
        if (isAuthCode || is401Rejection || hasAuthReason) {
          logger.info(
            '🔌 WebSocket closed: auth error, awaiting re-authentication',
          );
          return;
        }

        // Don't reconnect when explicitly disabled (e.g., during logout)
        if (!shouldAutoReconnect) {
          return;
        }

        // Schedule automatic reconnection with backoff
        scheduleReconnect();
      },
      error: (error: unknown) => {
        isReconnecting = false;
        const message =
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string'
            ? error.message
            : '';
        // RN delivers a contentless error event on routine socket drops; the
        // `closed` handler carries the actionable code/reason. Only warn when
        // RN actually gave us a message.
        if (message) {
          logger.warn('❌ WebSocket error:', { message });
        } else {
          logger.debug(
            '🔌 WebSocket transient error (no detail; see close event)',
          );
        }
      },
      connecting: () => {
        if (__DEV__) {
          logger.info('🔌 WebSocket connecting...', {
            url: WS_URL,
            timestamp: new Date().toISOString(),
          });
        }
      },
      ping: () => {
        if (__DEV__) {
          // logger.info('🏓 WebSocket ping sent');
        }
      },
      pong: () => {
        if (__DEV__) {
          // logger.info('🏓 WebSocket pong received');
        }
      },
    },
  });
};

// Initialize the client
wsClient = createWsClient();

export const wsLink = new GraphQLWsLink(wsClient);

// Function to reconnect WebSocket with new token
// Uses terminate() to force-close the connection, which triggers the `closed`
// handler in createWsClient. The library's lazy reconnection then re-establishes
// the connection, picking up the latest token via the connectionParams function.
export const reconnectWebSocket = () => {
  const now = Date.now();

  // Debounce reconnection attempts
  if (isReconnecting || now - lastReconnectTime < RECONNECT_DEBOUNCE_MS) {
    logger.info('🔌 WebSocket reconnection debounced or already in progress');
    return;
  }

  isReconnecting = true;
  lastReconnectTime = now;

  try {
    logger.info('🔄 WebSocket reconnecting with new token...');

    // Terminate forces an immediate close (unlike dispose which is graceful)
    // This triggers the `closed` handler which will call scheduleReconnect()
    // The new client created by scheduleReconnect gets the latest token
    // via the connectionParams function (already a function, so no hack needed)
    if (wsClient) {
      wsClient.terminate();
    }

    isReconnecting = false;
  } catch (error) {
    isReconnecting = false;
    logger.error('❌ WebSocket reconnection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    // Schedule another attempt if auto-reconnect is enabled
    if (shouldAutoReconnect) {
      scheduleReconnect();
    }
  }
};

/**
 * Resume a reconnect cycle that was deferred while the device was offline.
 * Called by useOnlineQueueSync on the offline→online transition. No-ops when
 * nothing was deferred or auto-reconnect is disabled (logout).
 */
export const resumeWebSocketAfterOnline = () => {
  if (!reconnectDeferredUntilOnline) return;
  reconnectDeferredUntilOnline = false;
  if (!shouldAutoReconnect) return;
  reconnectAttempts = 0;
  logger.info('🔌 Device back online — resuming deferred WebSocket reconnect');
  reconnectWebSocket();
};

// Export state checkers for other modules
export const isWebSocketReconnecting = () => isReconnecting;

/**
 * Disable automatic WebSocket reconnection.
 * Call this during logout to prevent reconnection attempts.
 */
export const disableAutoReconnect = () => {
  shouldAutoReconnect = false;
  reconnectDeferredUntilOnline = false;
  if (reconnectTimeoutId !== null) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  clearConnectionStableTimer();
  reconnectAttempts = 0;
};

/**
 * Enable automatic WebSocket reconnection.
 * Call this after login to allow reconnection on socket close.
 */
export const enableAutoReconnect = () => {
  shouldAutoReconnect = true;
};

// Export function to dispose WebSocket for logout cleanup
export const disposeWebSocket = () => {
  try {
    // Disable auto-reconnect before disposing
    disableAutoReconnect();
    if (wsClient) {
      logger.info('🔌 Disposing WebSocket client for logout');
      wsClient.dispose();
      isReconnecting = false;
      lastReconnectTime = 0;
    }
  } catch (error) {
    logger.warn('Error disposing WebSocket:', serializeError(error));
  }
};

// Export function to get WebSocket connection state
export const getWebSocketState = () => {
  return {
    isReconnecting,
    lastReconnectTime,
    hasClient: !!wsClient,
    reconnectAttempts,
  };
};
