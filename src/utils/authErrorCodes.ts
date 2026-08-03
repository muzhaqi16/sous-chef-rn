import { ErrorCode } from '#/graphql/generated/schemaTypes';

/**
 * Classification of the auth refusal codes that arrive as a `*Result` union
 * member's `code` (login, auto-login, refresh).
 *
 * Two questions get asked about the same code and they are NOT the same
 * question, so they get one list each — with the subset relationship spelled
 * out here rather than rediscovered per call site:
 *
 *  - {@link isDeadCredentialCode} — will the stored email/password ever
 *    authenticate again? Only these justify dropping keychain credentials and
 *    forcing a full biometric re-enrollment.
 *  - {@link isSessionEndingAuthCode} — can this session be revived at all? A
 *    superset: an expired/invalid/absent token kills the session while leaving
 *    the stored credentials perfectly good.
 *
 * `AUTH_ACCOUNT_LOCKED` is in neither, deliberately. The schema documents it as
 * a temporary, self-clearing failed-attempt lockout, so both paths defer
 * (auth state preserved, refresh retried later) instead of signing the user out
 * over a window that expires on its own.
 *
 * The lists are built from `ErrorCode` members rather than string literals so a
 * rename or removal on the next `npm run codegen` fails the build here, instead
 * of silently producing a predicate that never matches.
 */

// The credentials themselves are gone: the password changed elsewhere, or the
// account was suspended, banned or deleted.
const DEAD_CREDENTIAL_CODES: string[] = [
  ErrorCode.AuthCredentialsInvalid,
  ErrorCode.AuthAccountSuspended,
];

// Everything above, plus the token-side refusals — the refresh token can't be
// exchanged now or later, so the only correct move is to end the session.
const SESSION_ENDING_CODES: string[] = [
  ...DEAD_CREDENTIAL_CODES,
  ErrorCode.AuthRefreshTokenInvalid,
  ErrorCode.AuthTokenExpired,
  ErrorCode.AuthTokenMissing,
];

/**
 * The stored credentials will never authenticate again — drop them.
 *
 * Takes `string` rather than `ErrorCode` because the same conditions also reach
 * the client as a top-level error's `extensions.code`, which is untyped.
 */
export const isDeadCredentialCode = (code: string): boolean =>
  DEAD_CREDENTIAL_CODES.includes(code);

/** This session is unrecoverable — end it rather than retrying the refresh. */
export const isSessionEndingAuthCode = (code: string): boolean =>
  SESSION_ENDING_CODES.includes(code);
