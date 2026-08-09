/**
 * The vocabulary of `errors[].extensions.code` — the transport/protocol channel,
 * as opposed to `ErrorCode`, which types the `code` field on a `*Result` union
 * member.
 *
 * **This used to be generated.** The API published it as `enum
 * TopLevelErrorCode` until the admin-operation cleanup (2026-08-09), which left
 * the enum with no field referencing it; an unreachable type is absent from the
 * introspected schema, so `npm run codegen` stopped emitting it and eleven
 * modules lost their import. The API still *intends* it to exist — the
 * `ErrorCode` docstring in `schema.graphql` says "Both are typed by
 * `TopLevelErrorCode`, which names that channel's whole vocabulary" and points
 * rate limiting and internal failures at it. The server keeps sending these
 * strings; only the published type went away.
 *
 * So this mirrors the last generated copy verbatim, member names included, and
 * is a stopgap: if the API re-exposes the enum, delete this file and point the
 * imports back at `#/graphql/generated/schemaTypes` — nothing else changes.
 *
 * **What that costs.** These strings are no longer checked against the server.
 * `authErrorCodes.ts` used to be able to say that a renamed code fails the next
 * `codegen` rather than silently producing a predicate that never matches; for
 * the codes below that guarantee is gone. `topLevelErrorCodes.test.ts` buys part
 * of it back by pinning every condition that ALSO travels on the union channel
 * against the still-generated `ErrorCode`.
 *
 * **Do not substitute `ErrorCode` members for these.** The same condition is
 * spelled differently per channel — `RESOURCE_NOT_FOUND` here vs `NOT_FOUND`
 * there, `RESOURCE_CONFLICT` vs `CONFLICT`, `RESOURCE_VERSION_CONFLICT` vs
 * `VERSION_CONFLICT`. Swapping one for the other compiles and then matches
 * nothing at runtime.
 */
export enum TopLevelErrorCode {
  ApiKeyExpired = 'API_KEY_EXPIRED',
  /** The credential is valid; it is not permitted to perform this operation. Carries requiredPermission, so a client can tell 're-provision my key' from 'my key is wrong'. */
  ApiKeyInsufficientPermissions = 'API_KEY_INSUFFICIENT_PERMISSIONS',
  ApiKeyInvalid = 'API_KEY_INVALID',
  ApiKeyMissing = 'API_KEY_MISSING',
  ApiKeyRevoked = 'API_KEY_REVOKED',
  /** Failed-attempt lockout. Temporary and self-clearing — the caller may retry once the window elapses. */
  AuthAccountLocked = 'AUTH_ACCOUNT_LOCKED',
  /** Banned, suspended or deleted — a moderation decision, not a transient lockout. Clients end the session on this code. */
  AuthAccountSuspended = 'AUTH_ACCOUNT_SUSPENDED',
  /** Login rejection. Existence-blind by construction — the message is the same whether the email is unknown or the password is wrong. */
  AuthCredentialsInvalid = 'AUTH_CREDENTIALS_INVALID',
  /** Credentials are valid and the session is live; the account's email address is unverified. A 403, not a 401 — clients must not sign the user out. */
  AuthEmailNotVerified = 'AUTH_EMAIL_NOT_VERIFIED',
  /** Refresh token rejected by rotation (unverifiable, unknown, revoked or already used). */
  AuthRefreshTokenInvalid = 'AUTH_REFRESH_TOKEN_INVALID',
  AuthRefreshTokenMissing = 'AUTH_REFRESH_TOKEN_MISSING',
  /** Access token expired. On an ordinary operation this is what a refresh fixes; on the refresh response itself the session is over. */
  AuthTokenExpired = 'AUTH_TOKEN_EXPIRED',
  AuthTokenInvalid = 'AUTH_TOKEN_INVALID',
  /** Default code of the AuthenticationError base class, so it covers every bare throw across the resolver tree. */
  AuthTokenMissing = 'AUTH_TOKEN_MISSING',
  BadRequest = 'BAD_REQUEST',
  /** The client build is below the configured minimum for its client name (not its platform — one name covers iOS and Android). Carries minimumVersion. Retrying cannot fix it. */
  ClientUpgradeRequired = 'CLIENT_UPGRADE_REQUIRED',
  DbConstraintViolation = 'DB_CONSTRAINT_VIOLATION',
  EmailAlreadyExists = 'EMAIL_ALREADY_EXISTS',
  EmailAlreadyVerified = 'EMAIL_ALREADY_VERIFIED',
  /** Authenticated, active, and not allowed. The ONE authorization code, whichever layer refuses: the auth directive family, a service-thrown AuthorizationError, or the ForbiddenError union member. */
  Forbidden = 'FORBIDDEN',
  /** The caller is not a member of the home. Distinct from the union member's HOME_ACCESS_DENIED, which a mutation returns. */
  HomeNotAMember = 'HOME_NOT_A_MEMBER',
  /** An unexpected server fault. Masked in production, so only the code survives. */
  InternalServerError = 'INTERNAL_SERVER_ERROR',
  /** Per-operation limit. Names the operation that was limited and carries operation, limit, duration and retryAfter. */
  OperationRateLimited = 'OPERATION_RATE_LIMITED',
  /** The requested page multiplied out to more rows than the fan-out budget allows. */
  PaginationFanoutExceeded = 'PAGINATION_FANOUT_EXCEEDED',
  /** A pagination argument exceeded its per-field maximum. */
  PaginationLimitExceeded = 'PAGINATION_LIMIT_EXCEEDED',
  /** A thrown DuplicatePantryItemError escaping a resolver. Inside createPantryItem the same condition arrives as the DuplicatePantryItemError union member. */
  PantryItemAlreadyExists = 'PANTRY_ITEM_ALREADY_EXISTS',
  /** Global rate limit. Carries retryAfter in seconds. */
  RateLimitExceeded = 'RATE_LIMIT_EXCEEDED',
  ResourceAlreadyExists = 'RESOURCE_ALREADY_EXISTS',
  /** A thrown ConflictError escaping a resolver. The union-member spelling is CONFLICT. */
  ResourceConflict = 'RESOURCE_CONFLICT',
  /** A thrown NotFoundError escaping a resolver. The union-member spelling of this condition is NOT_FOUND. */
  ResourceNotFound = 'RESOURCE_NOT_FOUND',
  /** Optimistic-locking failure. The union-member spelling is VERSION_CONFLICT. */
  ResourceVersionConflict = 'RESOURCE_VERSION_CONFLICT',
  /** The server is shedding load or a dependency is down. Retryable. */
  ServiceUnavailable = 'SERVICE_UNAVAILABLE',
  /** The subscription could not be established. Retryable. */
  SubscriptionError = 'SUBSCRIPTION_ERROR',
  /** A subscription's filter threw while deciding whether to deliver an event. */
  SubscriptionFilterError = 'SUBSCRIPTION_FILTER_ERROR',
  /** The caller is at their concurrent-subscription cap. Carries current and max. */
  SubscriptionLimitExceeded = 'SUBSCRIPTION_LIMIT_EXCEEDED',
  /** No credentials were presented. Apollo's standard code, which clients already branch on. */
  Unauthenticated = 'UNAUTHENTICATED',
  /** The unit is not valid for the requested operation. Carries no machine-readable list of the units that would be: a mutation reports this as a ValidationError union member, which has no extensions, and the message names the acceptable alternatives in prose. To present them as options, re-query consumptionUnitsForItem or restockUnitsForItem. */
  UnitInvalid = 'UNIT_INVALID',
  ValidationFailed = 'VALIDATION_FAILED',
  ValidationUniqueConstraint = 'VALIDATION_UNIQUE_CONSTRAINT',
  /** A query or mutation was sent over the WebSocket, which accepts subscriptions only. Send it over HTTP POST /graphql instead. */
  WsOperationNotAllowed = 'WS_OPERATION_NOT_ALLOWED',
}
