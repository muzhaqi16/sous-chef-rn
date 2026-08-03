import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

/**
 * Classification of the auth refusal codes, across both channels they arrive
 * on: as a `*Result` union member's `code` (login, auto-login, refresh) and as
 * a top-level error's `extensions.code` on any ordinary operation.
 *
 * Three questions get asked about the same code and they are NOT the same
 * question, so they get one list each — with the relationships spelled out here
 * rather than rediscovered per call site:
 *
 *  - {@link isDeadCredentialCode} — will the stored email/password ever
 *    authenticate again? Only these justify dropping keychain credentials and
 *    forcing a full biometric re-enrollment.
 *  - {@link isSessionEndingAuthCode} — can this session be revived at all? A
 *    superset: an expired/invalid/absent token kills the session while leaving
 *    the stored credentials perfectly good.
 *  - {@link isRefreshableAuthCode} — would exchanging the refresh token clear
 *    this? Asked on the top-level channel, where the answer is the *opposite*
 *    of the one above for the same code, because the context differs: an
 *    `AUTH_TOKEN_EXPIRED` on the refresh mutation's own response means the
 *    exchange failed and the session is over, while the same code on an
 *    ordinary operation is exactly what a refresh fixes. Only ask this one
 *    about errors from operations other than the refresh itself.
 *
 * `AUTH_ACCOUNT_LOCKED` is in none of them, deliberately. The schema documents
 * it as a temporary, self-clearing failed-attempt lockout, so every path defers
 * (auth state preserved, refresh retried later) instead of signing the user out
 * over a window that expires on its own. `AUTH_EMAIL_NOT_VERIFIED` is likewise
 * absent: the token is valid and the account is fine, so it must neither end
 * the session nor spend a refresh — the caller prompts for verification and the
 * gate lifts on the next request.
 *
 * Every code here is a generated enum member, so a rename or removal on the next
 * `npm run codegen` fails the build instead of silently producing a predicate
 * that never matches. Which enum depends on the channel the code arrives on:
 * `ErrorCode` types the `code` field on a result-union member, while
 * `TopLevelErrorCode` publishes the vocabulary of `errors[].extensions.code`.
 * Conditions that travel on both channels carry the same string in both enums.
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

// Access-token-side refusals on an ordinary operation: the stored refresh token
// is untouched, so exchanging it mints a working access token and the operation
// can be replayed.
//
// `UNAUTHENTICATED` and `AUTH_TOKEN_INVALID` reach clients only on the top-level
// channel, so they come from `TopLevelErrorCode` rather than `ErrorCode`.
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

/**
 * A token refresh would clear this refusal — attempt one and replay.
 *
 * For top-level errors on operations *other than* the refresh mutation; see the
 * context note in the module docblock before reusing it elsewhere.
 */
export const isRefreshableAuthCode = (code: string): boolean =>
  REFRESHABLE_CODES.includes(code);

/** The refresh token is gone or rejected — end the session without retrying. */
export const isDeadRefreshTokenCode = (code: string): boolean =>
  DEAD_REFRESH_TOKEN_CODES.includes(code);

/**
 * Any auth refusal at all, whichever of the two token sides it names.
 *
 * The union of {@link isSessionEndingAuthCode} and {@link isRefreshableAuthCode},
 * which answer opposite questions — this is for the one caller that needs
 * neither answer, only "is this the auth pipeline's problem". The offline queue
 * asks it that way on purpose: it classifies the entry as `auth`, spends exactly
 * one refresh attempt, and lets the outcome decide, so it does not need to
 * predict which side of the family the code came from. Defined here rather than
 * OR-ed at the call site so the fourth question stays answered from the same
 * lists as the other three.
 */
export const isAuthRefusalCode = (code: string): boolean =>
  isSessionEndingAuthCode(code) || isRefreshableAuthCode(code);
