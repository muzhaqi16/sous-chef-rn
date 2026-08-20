import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient, Client } from 'graphql-ws';
import { Platform } from 'react-native';
import { env } from '#/config/env';
import { useStore } from '#store';
import { Environment, logger } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';
import { getDeviceId } from '#/utils/deviceId';
import { CLIENT_NAME, CLIENT_VERSION } from '../clientIdentity';
import { announceClientUpgradeRequired } from '../clientUpgradeNotice';
import {
  isProtocolErrorCloseCode,
  isRetryableWebSocketClose,
  WS_CLOSE_AUTH_FAILED,
  WS_CLOSE_CLIENT_REJECTED,
  WS_CLOSE_DURATION_EXCEEDED,
  WS_CLOSE_SESSION_AUTH,
  WS_CLOSE_UPGRADE_REQUIRED,
} from './wsCloseCodes';
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

// One-shot guard for 4403: set when a close already triggered a token refresh,
// cleared once a connection proves stable. It stops a socket the refresh cannot
// fix from spending one per close; the reconnect backoff takes over instead.
let sessionAuthRefreshAttempted = false;

// The 4403 recovery needs proactiveTokenRefresh, but refreshToken.ts already
// imports this module, so importing it back would be a cycle. It registers the
// function here at its own module init, which the link chain always runs before
// any socket exists.
let refreshAccessToken: (() => Promise<string | null>) | null = null;
export const registerTokenRefresh = (
  refresh: () => Promise<string | null>,
): void => {
  refreshAccessToken = refresh;
};

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

/**
 * Persist a token pair the server rotated during the handshake.
 *
 * The ack carries `tokenRefreshed: true` and a new pair whenever the server
 * rotated our expired access token, and it is the only delivery of that pair —
 * dropping it would leave HTTP on a token the socket has already replaced, and
 * strand a refresh token nothing can recover. An ordinary accept acks with no
 * payload, so absence means nothing changed rather than something failed.
 */
const persistRotatedTokensFromAck = (payload: unknown): void => {
  if (!payload || typeof payload !== 'object') return;

  const { tokenRefreshed, accessToken, refreshToken } = payload as {
    tokenRefreshed?: unknown;
    accessToken?: unknown;
    refreshToken?: unknown;
  };

  if (tokenRefreshed !== true) return;
  if (typeof accessToken !== 'string' || !accessToken) return;
  if (typeof refreshToken !== 'string' || !refreshToken) return;

  logger.info('🔌 WebSocket handshake rotated the token pair — persisting');
  useStore.getState().setTokens({ accessToken, refreshToken });
};

const createWsClient = () => {
  return createClient({
    url: WS_URL,
    webSocketImpl, // ← critical for RN
    lazy: true, // only connect on first subscribe
    keepAlive: getKeepAliveInterval(),
    // graphql-ws re-dials on its own, independently of the backoff in `closed`,
    // and its default treats 4411/4412/4413 as retryable. `shouldAutoReconnect`
    // cannot stop that — it only governs our own timer — so both read one table
    // (./wsCloseCodes).
    shouldRetry: isRetryableWebSocketClose,
    connectionParams: () => {
      const { accessToken: token, refreshToken } = useStore.getState();
      const apiKey = env.API_KEY;
      // Read the persisted id (not the nullable sync cache): this runs once
      // per connect, and a stable per-install deviceId is what lets the server
      // supersede our prior connection and reclaim its subscriptions on
      // reconnect. A null/changing id here forfeits that and leaves the old
      // subscriptions counting against the per-user cap until the heartbeat
      // reaps them.
      const deviceId = getDeviceId();

      const params: Record<string, string | undefined> = {};

      // Identify the build. Apollo's clientAwareness config only produces HTTP
      // headers, and the socket upgrade carries none — so the same name/version
      // pair is sent by hand here. Without it the server can't tell this build
      // apart from an outdated one and closes with 4411 once a minimum version
      // is configured.
      params['apollographql-client-name'] = CLIENT_NAME;
      params['apollographql-client-version'] = CLIENT_VERSION;

      // Always include API key if available
      if (apiKey) {
        params['x-api-key'] = apiKey;
      }

      // Include authorization only when token is available
      if (token) {
        params.authorization = `Bearer ${token}`;
      }

      // The refresh token rides along so the handshake can rotate an expired
      // access token itself and be accepted, instead of being refused 4403 and
      // needing a whole refresh-and-reconnect round trip first. The new pair
      // comes back in the ack (persistRotatedTokensFromAck).
      //
      // It is only spent when the access token has actually expired — a valid
      // one is accepted before the server ever reads this field. And racing the
      // HTTP path is safe: whichever rotation loses is refused as superseded,
      // which retries with the winner's successor rather than ending the
      // session.
      if (refreshToken) {
        params.refreshToken = refreshToken;
      }

      // deviceId does double duty: the server echoes it back as
      // originatorClientId so we can skip our own mutations' subscription
      // pushes, and it keys connection supersession — a new socket with this
      // same id terminates the still-tracked predecessor (old socket sees 1006)
      // and frees its subscriptions immediately.
      if (deviceId) {
        params.deviceId = deviceId;
      }

      if (__DEV__) {
        // The deviceId here must be non-null and identical across reloads for
        // the server to supersede the prior connection; a changing/absent value
        // means orphaned subscriptions accumulate against the per-user cap.
        logger.info('🔌 WebSocket connectionParams', {
          deviceId: deviceId ?? '(none)',
          hasToken: !!token,
          hasRefreshToken: !!refreshToken,
        });
      }

      return params;
    },
    on: {
      connected: (_socket: unknown, payload: unknown) => {
        isReconnecting = false;
        persistRotatedTokensFromAck(payload);
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
          // The connection held with the current token — a future 4403 is a
          // fresh expiry, so the refresh-then-reconnect recovery re-arms.
          sessionAuthRefreshAttempted = false;
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

        // This build is below the server's minimum version. Reconnecting sends
        // the same version and closes identically, so stop the cycle entirely
        // rather than backing off — only a store update can clear it. The HTTP
        // half surfaces the same refusal as CLIENT_UPGRADE_REQUIRED.
        if (code === WS_CLOSE_UPGRADE_REQUIRED) {
          shouldAutoReconnect = false;
          logger.error(
            `🔌 WebSocket closed: client upgrade required (app version ${CLIENT_VERSION}): ${reason}`,
          );
          // Shared with the HTTP half so the two transports announce once
          // between them, not once each.
          announceClientUpgradeRequired();
          return;
        }

        // The credentials cannot be refreshed into a working session: no token
        // was sent, the token is malformed, or the refresh token was rejected.
        // Retrying reproduces it exactly, so this is where a dead session has to
        // stop asking — and the session end is what puts the user in front of
        // the sign-in screen that actually resolves it.
        if (code === WS_CLOSE_AUTH_FAILED) {
          shouldAutoReconnect = false;
          logger.error(
            `🔌 WebSocket closed: re-authentication required (4412: ${reason}) — ending session`,
          );
          void useStore.getState().endSession('session_revoked');
          return;
        }

        // The API key was refused, not the user. Also permanent, but the session
        // is probably fine and signing the user out would hide a build or
        // deployment fault behind a login screen they cannot fix.
        if (code === WS_CLOSE_CLIENT_REJECTED) {
          shouldAutoReconnect = false;
          logger.error(
            `🔌 WebSocket closed: API key refused (4413: ${reason}) — real-time updates are unavailable for this build`,
          );
          return;
        }

        // The access token is stale — expired, or superseded by a rotation
        // another request won. Never terminal: anything unrecoverable arrives as
        // 4412 above.
        //
        // First 4403 spends one HTTP refresh, which reconnects the socket itself
        // on success (performTokenRefresh → reconnectWebSocket), so nothing is
        // scheduled here. Going through the refresh rather than reconnecting
        // straight away is what keeps a superseded rotation from being retried
        // with the same spent token: that decision lives in performTokenRefresh,
        // which only retries once a successor is actually stored. Dialling
        // blindly instead would re-present the spent token on a backoff that
        // crosses the server's ten-second reuse window, and a replay past it
        // revokes the whole lineage.
        //
        // A repeat before the connection proves stable falls through to the
        // ordinary backoff — the latch is a loop breaker, not a verdict.
        if (code === WS_CLOSE_SESSION_AUTH) {
          if (!sessionAuthRefreshAttempted) {
            sessionAuthRefreshAttempted = true;
            logger.info(
              `🔌 WebSocket closed: token stale (4403: ${reason}) — refreshing token`,
            );
            refreshAccessToken?.().catch(() => {
              // Refresh failed — reactive HTTP refresh recovers on the next
              // request and reconnects the socket then.
            });
            return;
          }

          logger.warn(
            `🔌 WebSocket closed: token still stale (4403: ${reason}) — reconnecting with backoff`,
          );
        }

        // Duration recycle: dial straight back (reset the backoff counter so
        // the reconnect lands at the base delay, not an escalated one).
        if (code === WS_CLOSE_DURATION_EXCEEDED) {
          if (shouldAutoReconnect) {
            reconnectAttempts = 0;
            scheduleReconnect();
          }
          return;
        }

        // Deterministic protocol violations (4400/4401/4406/4409): a client
        // bug the next attempt reproduces exactly. Stop reconnecting entirely —
        // backing off would just hot-loop against the same rejection.
        if (typeof code === 'number' && isProtocolErrorCloseCode(code)) {
          shouldAutoReconnect = false;
          logger.error(
            `🔌 WebSocket closed: protocol error (${code}: ${reason}) — not retrying`,
          );
          return;
        }

        if (__DEV__) {
          logger.info('🔌 WebSocket closed:', {
            code,
            reason: closeEvent?.reason,
            wasClean: closeEvent?.wasClean,
            timestamp: new Date().toISOString(),
          });
        }

        // Everything left — 4500, 4429, 1006, 1000 — is transient and falls
        // through to the backoff below. Auth refusals no longer reach here: the
        // server names each one with its own code above, so nothing has to be
        // inferred from a close reason, which is truncated in production anyway.

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
  sessionAuthRefreshAttempted = false;
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
      // Next session's first connect is a fresh connection, not a reconnect —
      // without this reset it would fire the reconnect listeners and trigger a
      // spurious notifications backfill.
      hasConnectedBefore = false;
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
