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

// The live graphql-ws client. Replaceable, because `dispose()` is one-way:
// it latches `disposed` inside the client with no reset, after which every
// retry silently gives up. A session that ends must therefore drop the client
// rather than keep a poisoned one for the next sign-in.
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

// Reconnection is graphql-ws's loop, not ours. It re-dials on its own after
// every retryable close, re-evaluating `connectionParams` each attempt.
//
// This module used to run a SECOND backoff beside it whose only action was
// `wsClient.terminate()` — which is `if (connecting) emit('closed')` and so
// does nothing once a socket has closed (graphql-ws clears `connecting` in its
// own close handler). It could interrupt a live connection; it could never
// dial one. Everything that looked like recovery went through it.
//
// What we DO own is the pacing, and it is deliberately not driven by the
// library's own `retries` argument. That counter means "consecutive FAILED
// dials" — graphql-ws resets it to 0 on every `connection_ack`
// (`dist/client.js:233`, commit "Lazy connects after successful reconnects are
// not retries"), which is correct for its purpose and useless for ours: a
// server that accepts the handshake and then immediately closes is not a
// failed dial, so the curve would never escalate. That is precisely the
// subscription-cap case CONNECTION_STABLE_MS exists for. So the count below is
// ours, and only a connection that proves stable clears it.
let dialAttempts = 0;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
let shouldAutoReconnect = true;

// Resolvers for retries parked until the device is back online. Dialling into
// an airplane-mode radio re-errors every active subscription and wakes the
// radio for nothing, so the wait is gated rather than timed.
let onlineWaiters: Array<() => void> = [];

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
// fix from spending one refresh per close.
let sessionAuthRefreshAttempted = false;

// The 4403 fast path needs proactiveTokenRefresh, but refreshToken.ts already
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

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Park a pending retry until the device is back online.
 *
 * Strict `=== false` mirrors isOnline's err-toward-online semantics: unknown
 * connectivity dials rather than stalling.
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
 * Drop every parked retry WITHOUT letting it dial.
 *
 * Resolving a waiter is the dial: graphql-ws constructs the socket on the line
 * after `await url()` (`dist/client.js`, inside the `connecting` promise) with
 * no `disposed` check in between, so a session end that released its waiters
 * opened one connection against credentials the server has already refused.
 *
 * Rejecting instead is worse, not better: that `await` sits in an async IIFE
 * inside a `new Promise` executor, so a rejection there is unhandled AND leaves
 * `connecting` permanently unsettled.
 *
 * So the promise is simply abandoned along with the client that owns it —
 * `disposeWebSocket` drops that reference, and the next sign-in builds a fresh
 * client. The cost is that a `dispose()` awaiting such a `connecting` never
 * settles; it is called un-awaited and immediately dereferenced, so nothing
 * observes it. Re-check on a graphql-ws upgrade: a `disposed` check between
 * `await url()` and the socket construction would make releasing correct again.
 */
const abandonOnlineWaiters = () => {
  onlineWaiters = [];
};

/**
 * Hold every dial until it is allowed to proceed, then count it.
 *
 * This runs from `url()`, which graphql-ws documents as "called on every
 * WebSocket connection attempt", stalling the connecting phase until it
 * resolves. That is the only hook that sees EVERY dial. `retryWait` — the
 * library's dedicated pacing hook, and where this logic would otherwise belong
 * — is skipped entirely for a close of 1000: `shouldRetryConnectOrThrow`
 * returns `locks > 0` before `retrying` is ever set, so `connect()` never
 * enters its wait. Code 1000 right after the handshake is exactly how this
 * server refuses a subscription over the per-user cap, so pacing that lives in
 * `retryWait` would not cover the one case it was written for. Measured against
 * the installed graphql-ws: an unpaced 1000 flap dials ~1259 times in 4s; the
 * same flap through this gate dials 8.
 *
 * The first dial after a stable connection is immediate — this only paces a
 * socket that keeps coming back.
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
      // This is also what makes a 4403 recoverable by a plain re-dial: the
      // retry re-runs this function, so the attempt after a stale-token close
      // presents whatever is stored now and can rotate server-side.
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
        persistRotatedTokensFromAck(payload);

        // A connect that follows a previous connection is a reconnect — backfill
        // listeners (notifications, etc.) catch anything missed while dropped.
        if (hasConnectedBefore) {
          notifyReconnectListeners();
        }
        hasConnectedBefore = true;

        // Defer the backoff reset until the connection proves stable. If the
        // server closes the socket before this fires (e.g. concurrent-
        // subscription cap rejection → code 1000), the `closed` handler clears
        // this timer so the library's own retry counter keeps escalating the
        // backoff instead of looping at the 1s base delay.
        clearConnectionStableTimer();
        connectionStableTimeoutId = setTimeout(() => {
          connectionStableTimeoutId = null;
          // The ONLY place the curve resets. Not on `connected` — a socket that
          // is accepted and then closed straight away has not proved anything,
          // and resetting there is what let the cap-rejection cycle repeat at
          // the base delay forever.
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

        // Everything below either records a verdict or spends one fast-path
        // refresh. None of it dials: `shouldRetry` + `retryWait` own that, and
        // a second mechanism here is what previously made "recovery" a no-op.

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
        // 4412 above, and the retry re-runs connectionParams, so the next
        // attempt presents whatever is stored by then and the server can rotate
        // it during the handshake.
        //
        // The HTTP refresh here is a FAST PATH, not the recovery: it gets a
        // fresh access token into the store before the backoff elapses. It is
        // spent once per unstable connection because a socket the refresh
        // cannot fix must not spend one per close.
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

        // Everything left — 4500, 4429, 1006, 1000 — is transient. Auth
        // refusals no longer reach here: the server names each one with its own
        // code above, so nothing has to be inferred from a close reason, which
        // is truncated in production anyway.
        //
        // 4429 and 4500 are the exception the subscription layer covers:
        // graphql-ws refuses to retry them whatever `shouldRetry` says
        // (isLibraryFatalCloseCode), so their subscriptions end and only a
        // re-subscribe brings delivery back.
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
 * A stable stand-in for the client, so the real one can be replaced.
 *
 * `GraphQLWsLink` captures whatever it is constructed with and only ever calls
 * `subscribe`, so handing it the client directly would pin the first instance
 * for the life of the process — including after `dispose()` has latched it
 * shut. Every method forwards to whichever client is current, creating one if
 * a session end dropped it.
 */
/**
 * Dispose a client without letting its rejection escape.
 *
 * `dispose()` is **async** and awaits graphql-ws's internal `connecting`
 * promise, which the library rejects with the RAW WebSocket event — a bare
 * `Event` when the upgrade fails (`websocketFailed`), a `CloseEvent` when the
 * socket closes. Neither carries a `message`, so an escaped one is reported as
 * `Unhandled Promise Rejection: Unknown error (Event; props: _defaultPrevented,
 * …)` with the close code stranded inside an object nothing reads.
 *
 * A synchronous `try`/`catch` around the call cannot see that: the promise
 * leaves the frame the moment `dispose()` returns. The window is widest exactly
 * when it matters — `url()` paces reconnects with a sleep of up to
 * `MAX_RECONNECT_DELAY_MS` INSIDE `connecting`, so while the API is unreachable
 * that promise is pending almost continuously, and a session end during an
 * outage is the common case rather than the rare one.
 *
 * The call itself stays synchronous — teardown must not be deferred a tick —
 * and only its result is normalized, covering both halves of the declared
 * `void | Promise<void>`. The assignment is the whole `try` body on purpose:
 * a value block inside one bails the React Compiler out of the function.
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
 * Force the socket to re-dial so it picks up a token that just changed.
 *
 * `terminate()` closes a live connection, which starts the library's retry —
 * and that retry re-runs `connectionParams`, which is the point. It does
 * nothing when no socket is open, which is correct rather than a gap: with no
 * connection there is also no subscription waiting on one, and the subscription
 * layer re-subscribing is what dials again.
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
 * Disable automatic WebSocket reconnection.
 * Call this during logout to prevent reconnection attempts.
 *
 * `shouldRetry` reads this flag, so it stops the library's loop as well as any
 * retry currently parked waiting to come back online.
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
 * Enable automatic WebSocket reconnection.
 * Call this after login to allow reconnection on socket close.
 *
 * Also restores a client if the previous session's teardown disposed one: a
 * disposed client connects once and then silently refuses every retry, so it
 * must not be inherited by a new session.
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
  // Dropped BEFORE the dispose can throw. `dispose()` is one-way inside
  // graphql-ws — a client that has been asked to dispose can only ever be a
  // client that silently refuses to retry — so a failed dispose is the one
  // case where keeping the reference is worst: it hands the next sign-in a
  // socket that connects once and then goes quiet.
  currentClient = null;
  // Module state, not client state. Reset whether or not there was a client to
  // dispose, so two session ends in a row leave the same thing behind as one.
  // Next session's first connect is a fresh connection, not a reconnect:
  // without this reset it would fire the reconnect listeners and trigger a
  // spurious notifications backfill.
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
