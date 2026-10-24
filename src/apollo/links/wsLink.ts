import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import type { Client } from 'graphql-ws';
import { createClient } from 'graphql-ws';
import { requirePlatform } from '#platform/install';
import { env } from '#/config/env';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { Telemetry } from '#/services/telemetry';
import { Environment, logger } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';
import { backoffDelay, sleep } from '#/utils/backoff';
import { getDeviceId } from '#/services/auth/deviceId';
import { CLIENT_NAME, clientVersion } from '../clientIdentity';
import { announceClientUpgradeRequired } from '../clientUpgradeNotice';
import {
  isProtocolErrorCloseCode,
  isRetryableWebSocketClose,
  WS_CLOSE_AUTH_FAILED,
  WS_CLOSE_CLIENT_REJECTED,
  WS_CLOSE_DURATION_EXCEEDED,
  WS_CLOSE_NORMAL,
  WS_CLOSE_SESSION_AUTH,
  WS_CLOSE_TERMINATED,
  WS_CLOSE_UPGRADE_REQUIRED,
} from './wsCloseCodes';

/**
 * The socket the host dials with. A host that must send headers on the
 * upgrade request (the client key, on mobile) passes its own subclass.
 */
export interface WebSocketTransport {
  /** The constructor graphql-ws dials with; the runtime's `WebSocket` by default. */
  webSocketImpl: unknown;
  /** Ping interval in ms; 12 s when unset. */
  keepAliveMs?: number;
}

const DEFAULT_KEEP_ALIVE_MS = 12_000;

let transport: WebSocketTransport = { webSocketImpl: globalThis.WebSocket };

// env.WEB_SOCKET_URL if set, else the environment's default. Read when a
// socket dials, not at load: the build config is a platform service.
const wsUrl = (): string =>
  env.WEB_SOCKET_URL ?? Environment.getApiConfig().wsUrl;

// Replaceable because `dispose()` is one-way: it latches `disposed` with no
// reset, after which every retry silently gives up. A session end must drop
// the client rather than hand the next sign-in a poisoned one.
let currentClient: Client | null = null;
let lastReconnectTime = 0;
const RECONNECT_DEBOUNCE_MS = 2000; // 2 seconds debounce for reconnections

// Reconnect listeners — fired when the socket reconnects after a prior drop:
// the client's `wsReconnected` resync and subscription transport recovery.
// First connect does NOT fire (it's not a reconnect).
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

// Ours, not graphql-ws's `retries`, which resets on every `connection_ack`: a
// server accepting the handshake then closing would never escalate the curve.
// Only a connection that proves stable clears this one.
let dialAttempts = 0;

// How far the current dial got. A close still at 'dialing' means no socket was
// ever established — RN reports a refused upgrade, an unreachable host and a
// dead radio identically, so the stage says only that, never why.
type DialStage = 'dialing' | 'opened' | 'acked';
let dialStage: DialStage = 'dialing';

// The refresh token the current dial presented: a pair its ack rotates renews
// THAT token, so it is stored only while that token still is.
let dialRefreshToken: string | undefined;

// One record per streak, then one per interval; the counter still counts every
// dial. The backoff is capped, so an unattended failure would otherwise write
// two records a minute for as long as the app stays open.
const DIAL_FAILURE_LOG_INTERVAL_MS = 300_000;
// `performance.now()` rather than `Date.now()`: a wall clock can step backwards
// and a negative elapsed reads as "not yet", muting the record until real time
// catches up. Null, not 0, because this clock STARTS near 0.
let lastDialFailureLogAt: number | null = null;

// A dial that never opens does not recover within a session as a dropped
// socket does, so past this many in a row the ceiling stretches. Only failures
// the device cannot explain away count (see the report).
const DIAL_FAILURE_STREAK_LIMIT = 5;
const STREAK_MAX_RECONNECT_DELAY_MS = 300_000;
let dialFailureStreak = 0;

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
let shouldAutoReconnect = true;

// Resolvers for retries parked until the device is back online. Dialling into
// an airplane-mode radio re-errors every active subscription and wakes the
// radio for nothing, so the wait is gated rather than timed.
let onlineWaiters: Array<() => void> = [];

// Over its concurrent-subscription cap the server closes the socket (1000)
// right after the handshake, so resetting the backoff on `connected` would
// loop connect→close→reconnect at the base delay forever.
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

// Same hand-off, one question: is the HTTP half mid-rotation right now?
let isHttpRefreshInFlight: (() => boolean) | null = null;
export const registerRefreshInFlightCheck = (
  isInFlight: () => boolean,
): void => {
  isHttpRefreshInFlight = isInFlight;
};

let connectionStableTimeoutId: ReturnType<typeof setTimeout> | null = null;

const clearConnectionStableTimer = () => {
  if (connectionStableTimeoutId !== null) {
    clearTimeout(connectionStableTimeoutId);
    connectionStableTimeoutId = null;
  }
};

/**
 * RN synthesises the same 1006 for a refused upgrade, an unreachable host and a
 * dead radio, so a dial closed before `opened` reports the close REASON and the
 * reachability label rather than a guess.
 */
const reportDialFailedBeforeOpen = (
  code: number | undefined,
  reason: string,
): void => {
  // A teardown drops the client without awaiting its dispose, so a socket from
  // the previous session can still close against a fresh one.
  if (!shouldAutoReconnect) return;

  const { isOnline, apiReachable } = useStore.getState();
  const reachable = apiReachable === null ? 'unknown' : String(apiReachable);

  Telemetry.increment('ws_dial_failures_total', 1, { reachable });

  // Only a failure the device cannot explain away escalates the backoff. The OS
  // aborts in-flight sockets when the app leaves the foreground, which is why
  // `apiReachabilityBreaker` discounts the same case.
  if (
    !isApiUnavailable({ isOnline, apiReachable }) &&
    requirePlatform('appLifecycle').current() === 'active'
  ) {
    dialFailureStreak++;
  }

  const now = performance.now();
  if (
    lastDialFailureLogAt !== null &&
    now - lastDialFailureLogAt < DIAL_FAILURE_LOG_INTERVAL_MS
  ) {
    return;
  }
  lastDialFailureLogAt = now;

  // Warn, not error: `TelemetryService` flushes an error record immediately, and
  // this path runs when the network is the thing in doubt. The counter is what
  // dashboards alert on.
  const detail = {
    close_code: code,
    close_reason: reason,
    dial_attempt: dialAttempts,
    dial_failure_streak: dialFailureStreak,
    is_online: isOnline,
    api_reachable: apiReachable,
    url: wsUrl(),
  };
  logger.warn('🔌 WebSocket dial closed before the socket opened', detail);
  Telemetry.warn('WebSocket dial closed before the socket opened', detail);
};

const getReconnectDelay = (attempt: number): number =>
  backoffDelay(attempt, {
    baseMs: BASE_RECONNECT_DELAY_MS,
    maxMs:
      dialFailureStreak >= DIAL_FAILURE_STREAK_LIMIT
        ? STREAK_MAX_RECONNECT_DELAY_MS
        : MAX_RECONNECT_DELAY_MS,
    jitter: 0.25,
  });

// Interruptible, so a network recovering mid-wait need not sit out the whole
// stretched ceiling. `proceed: false` abandons the wait: resolving IS the dial,
// as for an online waiter, so a teardown must not resolve.
let cancelDialDelay: ((proceed: boolean) => void) | null = null;

const delayDial = (ms: number): Promise<void> =>
  new Promise<void>(resolve => {
    const timeout = setTimeout(() => {
      cancelDialDelay = null;
      resolve();
    }, ms);
    cancelDialDelay = proceed => {
      clearTimeout(timeout);
      cancelDialDelay = null;
      if (proceed) resolve();
    };
  });

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
 * Drops every parked retry WITHOUT letting it dial: graphql-ws builds the
 * socket right after `await url()` with no `disposed` check, and rejecting
 * leaves `connecting` unsettled, so the promise is abandoned with its client.
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
    await delayDial(delay);
  }

  await waitUntilOnline();
  dialAttempts++;
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
  // Nothing presented, nothing a rotation could have renewed.
  if (!dialRefreshToken) return;

  logger.info('🔌 WebSocket handshake rotated the token pair — persisting');
  useStore
    .getState()
    .setTokens({ accessToken, refreshToken, replaces: dialRefreshToken });
};

const createWsClient = () => {
  return createClient({
    url: async () => {
      await awaitDialPermission();
      return wsUrl();
    },
    webSocketImpl: transport.webSocketImpl,
    lazy: true, // only connect on first subscribe
    keepAlive: transport.keepAliveMs ?? DEFAULT_KEEP_ALIVE_MS,
    // Unbounded: `awaitDialPermission` paces every dial, and a cap would end
    // real-time delivery for good after an outage longer than it.
    retryAttempts: Infinity,
    // Pacing lives in `url()` (awaitDialPermission). A macrotask, as a
    // microtask-only wait starves the timers the gate and the socket run on.
    retryWait: () => sleep(0),
    // Answers only whether a verdict is terminal (./wsCloseCodes), with
    // `shouldAutoReconnect` folded in: this is all that can stop a re-dial.
    shouldRetry: errOrCloseEvent =>
      shouldAutoReconnect && isRetryableWebSocketClose(errOrCloseEvent),
    connectionParams: () => {
      const { accessToken: token, refreshToken } = useStore.getState();
      const apiKey = env.API_KEY;
      // Null until storage opens, and omitted rather than substituted below: a
      // changing id leaves the prior connection's subscriptions counting against
      // the per-user cap until the heartbeat reaps them.
      const deviceId = getDeviceId();

      const params: Record<string, string | undefined> = {};

      // Sent by hand because Apollo's clientAwareness produces HTTP headers
      // for its own transport only. Without it the server closes 4411 once a
      // minimum version is configured.
      params['apollographql-client-name'] = CLIENT_NAME;
      params['apollographql-client-version'] = clientVersion();

      // Always include API key if available
      if (apiKey) {
        params['x-api-key'] = apiKey;
      }

      // Include authorization only when token is available
      if (token) {
        params.authorization = `Bearer ${token}`;
      }

      // Lets the handshake rotate an expired access token rather than refuse
      // 4403. Withheld while the HTTP half presents it, as rotation is
      // single-use; a dial then is refused 4403 and the next carries the pair.
      if (refreshToken && !isHttpRefreshInFlight?.()) {
        params.refreshToken = refreshToken;
      }
      dialRefreshToken = params.refreshToken;

      // Double duty: echoed back as originatorClientId so we skip our own
      // mutations' pushes, and it keys supersession — a new socket with the
      // same id terminates its predecessor and frees those subscriptions.
      if (deviceId) {
        params.deviceId = deviceId;
      }

      if (__DEV__) {
        // Supersession needs this identical across reloads; a changing or
        // absent value orphans subscriptions against the per-user cap.
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
        dialStage = 'acked';
        persistRotatedTokensFromAck(payload);

        // A connect that follows a previous connection is a reconnect — the
        // listeners resync what was missed while dropped.
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
          dialFailureStreak = 0;
          lastDialFailureLogAt = null;
          // The connection held with the current token — a future 4403 is a
          // fresh expiry, so the one-shot refresh fast path re-arms.
          sessionAuthRefreshAttempted = false;
        }, CONNECTION_STABLE_MS);

        if (__DEV__) {
          logger.info('🔌 WebSocket connected:', {
            url: wsUrl(),
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

        // A dial that never opened matches none of the branches below, so it
        // is recorded here or nowhere. A clean code at this stage is our own
        // dispose or terminate, not a failure.
        if (
          dialStage === 'dialing' &&
          code !== WS_CLOSE_NORMAL &&
          code !== WS_CLOSE_TERMINATED
        ) {
          reportDialFailedBeforeOpen(code, reason);
        }

        // Everything below records a verdict or spends one fast-path refresh.
        // None of it dials — `shouldRetry` + `retryWait` own that.

        // A reconnect sends the same version and closes identically, so stop
        // the cycle: only a store update clears it.
        if (code === WS_CLOSE_UPGRADE_REQUIRED) {
          shouldAutoReconnect = false;
          logger.error(
            `🔌 WebSocket closed: client upgrade required (app version ${clientVersion()}): ${reason}`,
          );
          // Shared with the HTTP half so the two transports announce once
          // between them, not once each.
          announceClientUpgradeRequired();
          return;
        }

        // No token, a malformed one, or a rejected refresh token: a retry
        // reproduces it exactly, so the dead session stops here and the session
        // end routes to sign-in.
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

        // Stale access token, never terminal: the retry re-runs
        // connectionParams. The HTTP refresh is a FAST PATH, spent once per
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

        // Everything left (4500, 4429, 1006, 1000) is transient, never read
        // from a close reason. graphql-ws refuses to retry 4429 and 4500, so
        // only the subscription layer's re-subscribe brings delivery back.
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
      opened: () => {
        dialStage = 'opened';
      },
      connecting: () => {
        dialStage = 'dialing';
        if (__DEV__) {
          logger.info('🔌 WebSocket connecting...', {
            url: wsUrl(),
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
  currentClient ??= createWsClient();
  return currentClient;
};

currentClient = createWsClient();

/**
 * Dial through the host's transport. Runs when the Apollo client is built,
 * before anything subscribes; the lazy client it replaces never connected.
 */
export const setWebSocketTransport = (next: WebSocketTransport): void => {
  transport = next;
  currentClient = createWsClient();
};

/**
 * `dispose()` rejects with the RAW WebSocket event, no `message`, beyond a
 * synchronous try/catch. The bare assignment in the `try` is deliberate: a
 * value block inside one bails the React Compiler out of the function.
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
  // Never rejects, so an awaiting caller gets orderly shutdown and a dropping
  // one leaks nothing. The reference goes FIRST, as in `disposeWebSocket`: a
  // disposed client refuses every retry.
  dispose: () => {
    const client = currentClient;
    currentClient = null;
    return client ? disposeSafely(client) : undefined;
  },
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
  // A dial parked on the backoff would otherwise hold the new token until the
  // wait elapsed, which past the streak limit is minutes.
  cancelDialDelay?.(true);

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
  const parked = onlineWaiters.length > 0 || cancelDialDelay !== null;
  if (!parked) return;
  logger.info('🔌 Device back online — resuming deferred WebSocket reconnect');
  dialAttempts = 0;
  dialFailureStreak = 0;
  cancelDialDelay?.(true);
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
  dialFailureStreak = 0;
  lastDialFailureLogAt = null;
  dialStage = 'dialing';
  cancelDialDelay?.(false);
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
  // listeners and triggering a spurious resync.
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
/** @internal Test seam. */
export const getWebSocketState = () => {
  return {
    lastReconnectTime,
    hasClient: !!currentClient,
    // Dials since the last connection that proved stable — what the backoff
    // curve is actually indexed on.
    reconnectAttempts: dialAttempts,
  };
};
