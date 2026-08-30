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

// Replaceable because `dispose()` is one-way: it latches `disposed` with no
// reset, after which every retry silently gives up. A session end must drop
// the client rather than hand the next sign-in a poisoned one.
let currentClient: Client | null = null;
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

// Re-dialling is graphql-ws's loop; never add a second one beside it. We own
// only the pacing, and this counter is ours rather than the library's `retries`
// argument: that one means "consecutive FAILED dials" and resets on every
// `connection_ack`, so a server accepting the handshake and closing straight
// after would never escalate the curve. Only a connection that proves stable
// clears this one.
let dialAttempts = 0;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
let shouldAutoReconnect = true;

// Resolvers for retries parked until the device is back online. Dialling into
// an airplane-mode radio re-errors every active subscription and wakes the
// radio for nothing, so the wait is gated rather than timed.
let onlineWaiters: Array<() => void> = [];

// How long a socket must stay open before the backoff counter resets. Over its
// concurrent-subscription cap the server closes the whole socket (code 1000)
// right after the handshake, so resetting on the bare `connected` event would
// loop connect→close→reconnect at the 1s base delay forever.
const CONNECTION_STABLE_MS = 10_000;

// One-shot guard for 4403: set when a close already triggered a token refresh,
// cleared once a connection proves stable. It stops a socket the refresh cannot
// fix from spending one refresh per close.
let sessionAuthRefreshAttempted = false;

// Registered by refreshToken.ts at its module init — importing it here would
// be a cycle, since it already imports this module.
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

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Park a pending retry until the device is back online. Strict `=== false`
 * mirrors isOnline: unknown connectivity dials rather than stalling.
 */
const waitUntilOnline = (): Promise<void> => {
  if (useStore.getState().isOnline !== false) return Promise.resolve();

  logger.info(
    '🔌 WebSocket reconnect deferred until the device is back online',
  );
  return new Promise<void>(resolve => {
    onlineWaiters.push(resolve);
  });
};

/** Let every parked retry proceed. The dial is the point here. */
const releaseOnlineWaiters = () => {
  const waiters = onlineWaiters;
  onlineWaiters = [];
  waiters.forEach(resolve => resolve());
};

/**
 * Drop every parked retry WITHOUT letting it dial. Resolving a waiter IS the
 * dial — graphql-ws builds the socket right after `await url()` with no
 * `disposed` check — and rejecting leaves `connecting` permanently unsettled.
 * So the promise is abandoned with the client that owns it.
 */
const abandonOnlineWaiters = () => {
  onlineWaiters = [];
};

/**
 * Hold every dial until allowed, then count it. Pacing lives in `url()` because
 * `retryWait` is skipped entirely for a close of 1000 — exactly how the server
 * refuses a subscription over the per-user cap.
 */
const awaitDialPermission = async (): Promise<void> => {
  if (dialAttempts > 0) {
    const delay = getReconnectDelay(dialAttempts - 1);
    logger.info(
      `🔄 WebSocket re-dialling in ${Math.round(delay)}ms (attempt ${
        dialAttempts + 1
      } since the last stable connection)`,
    );
    await sleep(delay);
  }

  await waitUntilOnline();
  dialAttempts++;
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
 * Persist a token pair the server rotated during the handshake. The ack is the
 * ONLY delivery of that pair; an ordinary accept carries no payload, so absence
 * means nothing changed rather than something failed.
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
    url: async () => {
      await awaitDialPermission();
      return WS_URL;
    },
    webSocketImpl, // ← critical for RN
    lazy: true, // only connect on first subscribe
    keepAlive: getKeepAliveInterval(),
    // Unbounded on purpose. `awaitDialPermission` gates on connectivity and
    // never dials faster than the 30s ceiling, so an unbounded count costs
    // nothing — whereas a cap would mean real-time delivery stops permanently
    // after an outage longer than it, with nothing left to restart it.
    retryAttempts: Infinity,
    // Pacing lives in `url()` instead, because that is the only hook every dial
    // passes through (see awaitDialPermission). Resolving on a macrotask rather
    // than a microtask: a microtask-only wait starves the timers the gate and
    // the socket both run on.
    retryWait: () => sleep(0),
    // The one hook over the library's loop, and it answers only "is this
    // verdict terminal" (./wsCloseCodes). `shouldAutoReconnect` is folded in
    // here rather than kept in a timer of our own, because this is now the
    // only thing that can stop a re-dial.
    shouldRetry: errOrCloseEvent =>
      shouldAutoReconnect && isRetryableWebSocketClose(errOrCloseEvent),
    connectionParams: () => {
      const { accessToken: token, refreshToken } = useStore.getState();
      const apiKey = env.API_KEY;
      // The persisted id, not the nullable sync cache: a stable per-install
      // deviceId is what lets the server supersede our prior connection and
      // reclaim its subscriptions. A null or changing one leaves them counting
      // against the per-user cap until the heartbeat reaps them.
      const deviceId = getDeviceId();

      const params: Record<string, string | undefined> = {};

      // Sent by hand because Apollo's clientAwareness only produces HTTP
      // headers and the socket upgrade carries none. Without it the server
      // closes 4411 once a minimum version is configured.
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

      // Rides along so the handshake can rotate an expired access token itself
      // rather than being refused 4403; the new pair returns in the ack. This
      // is what makes 4403 recoverable by a plain re-dial, since the retry
      // re-runs this function. Racing the HTTP path is safe — the losing
      // rotation is refused as superseded and retries with the winner's
      // successor.
      if (refreshToken) {
        params.refreshToken = refreshToken;
      }

      // Double duty: echoed back as originatorClientId so we skip our own
      // mutations' pushes, and it keys supersession — a new socket with the
      // same id terminates its predecessor and frees those subscriptions.
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
        persistRotatedTokensFromAck(payload);

        // A connect that follows a previous connection is a reconnect — backfill
        // listeners (notifications, etc.) catch anything missed while dropped.
        if (hasConnectedBefore) {
          notifyReconnectListeners();
        }
        hasConnectedBefore = true;

        // Deferred until the connection proves stable: a close before this
        // fires (cap rejection → 1000) clears the timer, so the backoff keeps
        // escalating instead of looping at the 1s base delay.
        clearConnectionStableTimer();
        connectionStableTimeoutId = setTimeout(() => {
          connectionStableTimeoutId = null;
          // The ONLY place the curve resets. Not on `connected`: a socket
          // accepted and closed straight away has proved nothing.
          dialAttempts = 0;
          // The connection held with the current token — a future 4403 is a
          // fresh expiry, so the one-shot refresh fast path re-arms.
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

        // Everything below records a verdict or spends one fast-path refresh.
        // None of it dials — `shouldRetry` + `retryWait` own that.

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

        // Stale access token. Never terminal — anything unrecoverable arrives
        // as 4412 above, and the retry re-runs connectionParams. The HTTP
        // refresh is a FAST PATH, not the recovery, and is spent once per
        // unstable connection.
        if (code === WS_CLOSE_SESSION_AUTH) {
          if (!sessionAuthRefreshAttempted) {
            sessionAuthRefreshAttempted = true;
            logger.info(
              `🔌 WebSocket closed: token stale (4403: ${reason}) — refreshing token`,
            );
            refreshAccessToken?.().catch(() => {
              // Refresh failed — the retry still re-dials with the refresh
              // token in connectionParams, and the reactive HTTP refresh
              // recovers on the next request.
            });
          } else {
            logger.warn(
              `🔌 WebSocket closed: token still stale (4403: ${reason}) — retrying with backoff`,
            );
          }
          return;
        }

        // Duration recycle: an operational close, not a fault. Reset the
        // counter so the library's next wait lands at the base delay rather
        // than an escalated one.
        if (code === WS_CLOSE_DURATION_EXCEEDED) {
          dialAttempts = 0;
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

        // Everything left — 4500, 4429, 1006, 1000 — is transient; each auth
        // refusal has its own code above, so nothing is inferred from a close
        // reason. 4429 and 4500 are the exception the subscription layer
        // covers: graphql-ws refuses to retry them, so their subscriptions end
        // and only a re-subscribe brings delivery back.
      },
      error: (error: unknown) => {
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

const getOrCreateClient = (): Client => {
  if (!currentClient) {
    currentClient = createWsClient();
  }
  return currentClient;
};

currentClient = createWsClient();

/**
 * Dispose without letting the rejection escape: `dispose()` rejects with the
 * RAW WebSocket event, which has no `message`, and a synchronous try/catch
 * cannot see it. The bare assignment in the `try` is deliberate — a value
 * block inside one bails the React Compiler out of the function.
 */
const disposeSafely = (client: Client): Promise<void> => {
  let pending: void | Promise<void>;
  try {
    pending = client.dispose();
  } catch (error) {
    logger.warn('WebSocket dispose failed:', serializeError(error));
    return Promise.resolve();
  }
  return Promise.resolve(pending).catch(error => {
    logger.warn('WebSocket dispose failed:', serializeError(error));
  });
};

/**
 * A stable stand-in so the real client can be replaced: `GraphQLWsLink` captures
 * whatever it is constructed with, which would pin the first instance for the
 * process's life — including after `dispose()` latched it shut.
 */
const wsClientFacade: Client = {
  on: (...args: Parameters<Client['on']>) => getOrCreateClient().on(...args),
  subscribe: (...args: Parameters<Client['subscribe']>) =>
    getOrCreateClient().subscribe(...args),
  iterate: (...args: Parameters<Client['iterate']>) =>
    getOrCreateClient().iterate(...args),
  // Returns a promise that never rejects, so a caller that awaits it still
  // gets orderly shutdown and one that drops it leaks nothing.
  dispose: () => (currentClient ? disposeSafely(currentClient) : undefined),
  terminate: () => currentClient?.terminate(),
};

export const wsLink = new GraphQLWsLink(wsClientFacade);

/**
 * Force a re-dial so the socket picks up a token that just changed; the retry
 * re-runs `connectionParams`. A no-op with no socket open — correct, since the
 * subscription layer re-subscribing is what dials again.
 */
export const reconnectWebSocket = () => {
  const now = Date.now();

  if (now - lastReconnectTime < RECONNECT_DEBOUNCE_MS) {
    logger.info('🔌 WebSocket reconnection debounced');
    return;
  }

  lastReconnectTime = now;

  try {
    logger.info('🔄 WebSocket reconnecting with new token...');
    currentClient?.terminate();
  } catch (error) {
    logger.error('❌ WebSocket reconnection failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Resume retries that were parked while the device was offline.
 * Called by useOnlineQueueSync on the offline→online transition.
 */
export const resumeWebSocketAfterOnline = () => {
  if (onlineWaiters.length === 0) return;
  logger.info('🔌 Device back online — resuming deferred WebSocket reconnect');
  dialAttempts = 0;
  releaseOnlineWaiters();
};

/**
 * Disable automatic reconnection, on logout. `shouldRetry` reads this flag, so
 * it stops the library's loop and any retry parked waiting to come online.
 */
export const disableAutoReconnect = () => {
  shouldAutoReconnect = false;
  clearConnectionStableTimer();
  dialAttempts = 0;
  sessionAuthRefreshAttempted = false;
  // Not `releaseOnlineWaiters` — that would dial. See abandonOnlineWaiters.
  abandonOnlineWaiters();
};

/**
 * Enable automatic reconnection, after login. Also restores a client if the last
 * session's teardown disposed one — a disposed one silently refuses every retry.
 */
export const enableAutoReconnect = () => {
  shouldAutoReconnect = true;
  getOrCreateClient();
};

// Export function to dispose WebSocket for logout cleanup
export const disposeWebSocket = () => {
  // Disable auto-reconnect before disposing
  disableAutoReconnect();

  const client = currentClient;
  // Dropped BEFORE the dispose can throw: a client asked to dispose silently
  // refuses every retry, so keeping the reference on failure is worst of all.
  currentClient = null;
  // Module state, reset whether or not there was a client, so the next
  // session's first connect counts as fresh rather than firing the reconnect
  // listeners and triggering a spurious notifications backfill.
  lastReconnectTime = 0;
  hasConnectedBefore = false;

  if (!client) return;

  logger.info('🔌 Disposing WebSocket client for logout');
  // Deliberately not awaited — a session end must not block on a socket that
  // may be mid-reconnect. `disposeSafely` owns the rejection, which a bare
  // `client.dispose()` here leaked as an unhandled raw WebSocket `Event`.
  void disposeSafely(client);
};

// Export function to get WebSocket connection state
export const getWebSocketState = () => {
  return {
    lastReconnectTime,
    hasClient: !!currentClient,
    // Dials since the last connection that proved stable — what the backoff
    // curve is actually indexed on.
    reconnectAttempts: dialAttempts,
  };
};
