import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

/**
 * Auth refusal codes across both channels: a `*Result` member's `code` and a
 * top-level `extensions.code`. Four different questions, one list each. Every
 * code is a generated enum member, so a codegen rename fails the build rather
 * than yielding a predicate that never matches.
 */

// The credentials themselves are gone: the password changed elsewhere, or the
// account was suspended, banned or deleted.
//
// `AUTH_ACCOUNT_LOCKED` and `AUTH_EMAIL_NOT_VERIFIED` are in NO list below, on
// purpose: the first is a self-clearing window, the second leaves the token
// valid, so neither may end a session or spend a refresh.
const DEAD_CREDENTIAL_CODES: string[] = [
  ErrorCode.AuthCredentialsInvalid,
  ErrorCode.AuthAccountSuspended,
];

// Plus the token-side refusals: the refresh token cannot be exchanged now or
// later. AUTH_REFRESH_TOKEN_SUPERSEDED is pointedly ABSENT — same failed
// exchange, living session; listing it turns a lost race into a sign-out.
const SESSION_ENDING_CODES: string[] = [
  ...DEAD_CREDENTIAL_CODES,
  ErrorCode.AuthRefreshTokenInvalid,
  ErrorCode.AuthTokenExpired,
  ErrorCode.AuthTokenMissing,
];

// Access-token-side refusals on an ordinary operation: the refresh token is
// untouched, so an exchange mints a working one and the operation replays.
// `UNAUTHENTICATED`/`AUTH_TOKEN_INVALID` reach clients only on the top-level
// channel, hence `TopLevelErrorCode`.
const REFRESHABLE_CODES: string[] = [
  ErrorCode.AuthTokenExpired,
  ErrorCode.AuthTokenMissing,
  TopLevelErrorCode.Unauthenticated,
  TopLevelErrorCode.AuthTokenInvalid,
];

// The refresh token itself is missing or rejected, so there is nothing left to
// exchange — attempting a refresh just spends a round trip on a guaranteed
// rejection.
const DEAD_REFRESH_TOKEN_CODES: string[] = [
  ErrorCode.AuthRefreshTokenInvalid,
  TopLevelErrorCode.AuthRefreshTokenMissing,
];

// The token we presented was spent by a rotation that beat us to it, and its
// successor is valid. The exchange failed; the session did not.
const SUPERSEDED_REFRESH_CODES: string[] = [
  ErrorCode.AuthRefreshTokenSuperseded,
];

/**
 * The stored credentials will never authenticate again — drop them. Takes
 * `string`, not `ErrorCode`: `extensions.code` arrives untyped.
 */
export const isDeadCredentialCode = (code: string): boolean =>
  DEAD_CREDENTIAL_CODES.includes(code);

/** This session is unrecoverable — end it rather than retrying the refresh. */
export const isSessionEndingAuthCode = (code: string): boolean =>
  SESSION_ENDING_CODES.includes(code);

/**
 * A refresh would clear this — attempt one and replay. Context-dependent: ask it
 * ONLY about operations other than the refresh mutation, whose own
 * `AUTH_TOKEN_EXPIRED` means the exchange failed and the session is over.
 */
export const isRefreshableAuthCode = (code: string): boolean =>
  REFRESHABLE_CODES.includes(code);

/** The refresh token is gone or rejected — end the session without retrying. */
export const isDeadRefreshTokenCode = (code: string): boolean =>
  DEAD_REFRESH_TOKEN_CODES.includes(code);

/**
 * Somebody else rotated first: retry with the successor they stored, i.e. a
 * DIFFERENT token. Re-sending the refused one hot-loops through the reuse grace
 * window, past which a replay is read as compromise and revokes the lineage.
 */
export const isSupersededRefreshCode = (code: string): boolean =>
  SUPERSEDED_REFRESH_CODES.includes(code);

/**
 * The union of the other three, for the one caller that needs none of their
 * distinctions — only "is this the auth pipeline's problem". The offline queue
 * classifies the entry as `auth`, spends one refresh attempt and lets the
 * outcome decide, so it never has to predict which side the code came from.
 */
export const isAuthRefusalCode = (code: string): boolean =>
  isSessionEndingAuthCode(code) ||
  isRefreshableAuthCode(code) ||
  isSupersededRefreshCode(code);
