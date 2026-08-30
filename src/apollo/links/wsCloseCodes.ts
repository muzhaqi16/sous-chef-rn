/**
 * Close codes and the verdict for each. `shouldRetry: false` makes graphql-ws
 * rethrow, erroring every active subscription sink, so it is reserved for
 * closes no retry can fix. Some codes it rethrows before ever asking — see
 * {@link isLibraryFatalCloseCode}.
 */

/** The access token expired, at connect or mid-stream. Recoverable — see below. */
export const WS_CLOSE_SESSION_AUTH = 4403;
/** A subscription hit its lifetime cap. Not an error — reconnect immediately. */
export const WS_CLOSE_DURATION_EXCEEDED = 4410;
/** This build is below the server's minimum version. Only an app update clears it. */
export const WS_CLOSE_UPGRADE_REQUIRED = 4411;
/** Credentials cannot be refreshed into a working session. Sign in again. */
export const WS_CLOSE_AUTH_FAILED = 4412;
/** The API key was refused — a build fault, not the user's session. */
export const WS_CLOSE_CLIENT_REJECTED = 4413;
/** Duplicate connection_init. Transient, but see `isLibraryFatalCloseCode`. */
export const WS_CLOSE_TOO_MANY_INIT_REQUESTS = 4429;
/** A genuine server-side fault. Transient, but see `isLibraryFatalCloseCode`. */
export const WS_CLOSE_INTERNAL_SERVER_ERROR = 4500;

/**
 * Deterministic graphql-ws protocol violations: malformed frame (4400),
 * subscribing before connection_ack (4401), unacceptable subprotocol (4406),
 * duplicate operation id (4409). Each is a client bug — the next attempt sends
 * the same bad frame.
 */
const PROTOCOL_ERROR_CODES = [4400, 4401, 4406, 4409];

/**
 * Closes where re-dialling reproduces the same rejection, so the client stops
 * until a person or a code change intervenes. 4403 is deliberately NOT here: it
 * means the access token was stale, and a re-dial recovers on its own because
 * `connectionParams` is re-evaluated per attempt.
 */
const NEVER_RETRY_CODES = new Set<number>([
  ...PROTOCOL_ERROR_CODES,
  WS_CLOSE_UPGRADE_REQUIRED,
  WS_CLOSE_AUTH_FAILED,
  WS_CLOSE_CLIENT_REJECTED,
]);

/**
 * Codes graphql-ws refuses to retry whatever `shouldRetry` returns. The two we
 * consider transient (4429, 4500) therefore end their subscriptions, which is
 * why the subscription layer re-subscribes on a transport error rather than
 * trusting the socket to return.
 */
const LIBRARY_FATAL_CODES = new Set<number>([
  ...PROTOCOL_ERROR_CODES,
  WS_CLOSE_INTERNAL_SERVER_ERROR,
  WS_CLOSE_TOO_MANY_INIT_REQUESTS,
  4005, // InternalClientError — graphql-ws's own, never sent by our server
  4004, // BadResponse — likewise
]);

const NON_FATAL_INTERNAL_CODES = new Set<number>([
  1000, 1001, 1005, 1006, 1012, 1013, 1014,
]);

export const isProtocolErrorCloseCode = (code: number): boolean =>
  PROTOCOL_ERROR_CODES.includes(code);

/**
 * Whether graphql-ws will refuse to retry this close regardless of
 * {@link isRetryableWebSocketClose}.
 */
export const isLibraryFatalCloseCode = (code: number): boolean => {
  if (LIBRARY_FATAL_CODES.has(code)) return true;
  if (NON_FATAL_INTERNAL_CODES.has(code)) return false;
  return code >= 1000 && code <= 1999;
};

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
