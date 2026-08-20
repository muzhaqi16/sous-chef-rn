/**
 * WebSocket close codes and what the client does about each one.
 *
 * Two things act on a close and they must not disagree: `shouldRetry`, which
 * graphql-ws consults before re-dialling on its own, and the `closed` handler in
 * wsLink, which drives the app's backoff and the recovery a given code needs.
 * The library's default `shouldRetry` re-dials 4411/4412/4413, and
 * `shouldAutoReconnect` cannot stop it — that flag governs only our own timer.
 * So the verdict lives here and both callers read it.
 *
 * The codes are the API's (`sous-chef-api`
 * packages/core/src/subscriptions/core/wsCloseCodes.ts). They are plain numbers
 * on the wire, so nothing type-checks them against the server.
 */

/** The access token expired, at connect or mid-stream. Refresh, then reconnect. */
export const WS_CLOSE_SESSION_AUTH = 4403;
/** A subscription hit its lifetime cap. Not an error — reconnect immediately. */
export const WS_CLOSE_DURATION_EXCEEDED = 4410;
/** This build is below the server's minimum version. Only an app update clears it. */
export const WS_CLOSE_UPGRADE_REQUIRED = 4411;
/** Credentials cannot be refreshed into a working session. Sign in again. */
export const WS_CLOSE_AUTH_FAILED = 4412;
/** The API key was refused — a build fault, not the user's session. */
export const WS_CLOSE_CLIENT_REJECTED = 4413;
/** Duplicate connection_init. Transient; back off. */
export const WS_CLOSE_TOO_MANY_INIT_REQUESTS = 4429;
/** A genuine server-side fault. Transient; back off. */
export const WS_CLOSE_INTERNAL_SERVER_ERROR = 4500;

/**
 * Deterministic graphql-ws protocol violations: malformed frame (4400),
 * subscribing before connection_ack (4401), unacceptable subprotocol (4406),
 * duplicate operation id (4409). Each is a client bug — the next attempt sends
 * the same bad frame.
 */
const PROTOCOL_ERROR_CODES = [4400, 4401, 4406, 4409];

/**
 * Closes where re-dialling reproduces the same rejection, so the client must
 * stop until a person or a code change intervenes.
 *
 * 4403 is here for a different reason than the rest: it IS recoverable, but only
 * after a token refresh, and the `closed` handler owns that sequence. Letting the
 * library re-dial in parallel would just re-present the expired token.
 */
const NEVER_RETRY_CODES = new Set<number>([
  ...PROTOCOL_ERROR_CODES,
  WS_CLOSE_SESSION_AUTH,
  WS_CLOSE_UPGRADE_REQUIRED,
  WS_CLOSE_AUTH_FAILED,
  WS_CLOSE_CLIENT_REJECTED,
]);

export const isProtocolErrorCloseCode = (code: number): boolean =>
  PROTOCOL_ERROR_CODES.includes(code);

/**
 * Whether graphql-ws may re-dial after this close.
 *
 * A value with no numeric `code` is not a close at all — a DNS or TCP failure,
 * say — and those are transient, so they retry.
 */
export const isRetryableWebSocketClose = (
  errOrCloseEvent: unknown,
): boolean => {
  const code =
    errOrCloseEvent && typeof errOrCloseEvent === 'object'
      ? (errOrCloseEvent as { code?: unknown }).code
      : undefined;

  if (typeof code !== 'number') return true;

  return !NEVER_RETRY_CODES.has(code);
};
