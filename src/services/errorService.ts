/**
 * Error Service - Unified error handling for the application
 *
 * This service provides:
 * 1. Structured error parsing with Telemetry integration
 * 2. Error wrapper functions for mutations
 * 3. Returns typed results instead of showing alerts
 * 4. Works with toast/snackbar service for user feedback
 * 5. reportError() for non-Apollo errors
 *
 * Usage:
 * ```typescript
 * const { handleApolloError } = useErrorService();
 * const { message } = handleApolloError(error, { operation: 'Update Item' });
 * Alert.alert('Error', message);
 * ```
 */

import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { logger } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';
import {
  GraphQLDomainError,
  GraphQLNetworkError,
} from '#/utils/errors/graphqlErrors';
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
  ServerParseError,
} from '@apollo/client/errors';
import {
  isQueryComplexityError,
  getQueryComplexityMessage,
} from '#/utils/errors/queryComplexity';
import {
  isVersionConflictError,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { Telemetry } from '#/services/telemetry';
import { t } from '#/i18n';

/**
 * Result type for error operations
 */
export interface ErrorResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    category: string;
    shouldRetry: boolean;
    isAuthError: boolean;
    validationErrors?: Record<string, string>;
  };
}

/**
 * Flat error result matching the legacy handleApolloError return shape
 */
export interface ApolloErrorResult {
  code: string;
  message: string;
  category: string;
  shouldRetry: boolean;
  isAuthError: boolean;
  validationErrors?: Record<string, string>;
}

/**
 * Configuration for error handling
 */
export interface ErrorConfig {
  operation?: string;
  customMessage?: string;
  logError?: boolean;
}

export class ErrorService {
  /**
   * Error code → i18n key *suffix*. Each value is a fragment, not a whole key:
   * {@link getUserFriendlyMessage} composes it as `errors.codes.<suffix>`, so
   * `'signInRequired'` resolves `errors.codes.signInRequired`.
   *
   * Key suffixes, not strings: these messages are shown to the user (login
   * failures and password-reset refusals are the most-seen strings in the app),
   * and the app ships four locales. Resolution happens per call in
   * {@link getUserFriendlyMessage} rather than here, because this table is a
   * static class field — evaluating `t()` at module load would freeze whatever
   * language happened to be active first and ignore later changes.
   *
   * Codes that warrant the same sentence deliberately share a suffix rather
   * than getting near-duplicate translations that can drift apart.
   */
  private static readonly ERROR_MESSAGE_KEY_SUFFIXES: Record<string, string> = {
    // Authentication Errors
    AUTH_TOKEN_MISSING: 'signInRequired',
    AUTH_TOKEN_INVALID: 'sessionInvalid',
    AUTH_TOKEN_EXPIRED: 'sessionExpired',
    AUTH_REFRESH_TOKEN_MISSING: 'sessionEnded',
    AUTH_REFRESH_TOKEN_INVALID: 'sessionEnded',
    // Its own sentence, not a shared session-ending one. The exchange lost a
    // rotation race and the session is alive; the refresh path recovers without
    // the user doing anything. 'sessionExpired' and 'sessionEnded' BOTH read
    // "Please sign in again", so either would tell the user to fix something
    // that is already fixing itself — and send them to a sign-in screen their
    // live session does not need.
    AUTH_REFRESH_TOKEN_SUPERSEDED: 'sessionRetrying',
    AUTH_CREDENTIALS_INVALID: 'credentialsInvalid',
    AUTH_ACCOUNT_LOCKED: 'accountLocked',
    // Distinct from the lockout above: a moderation decision, not a window
    // that expires. Says nothing about why, and points at support rather than
    // inviting a retry that can never succeed.
    AUTH_ACCOUNT_SUSPENDED: 'accountSuspended',
    AUTH_EMAIL_NOT_VERIFIED: 'emailNotVerified',

    // Authorization Errors. FORBIDDEN is the only code here.
    FORBIDDEN: 'forbidden',

    // API Key Errors. All of these are build/config faults the user can do
    // nothing about, so they share one deliberately generic message.
    API_KEY_MISSING: 'genericLater',
    API_KEY_INVALID: 'genericLater',
    API_KEY_EXPIRED: 'genericLater',
    API_KEY_REVOKED: 'genericLater',
    API_KEY_RATE_LIMITED: 'genericLater',
    API_KEY_INSUFFICIENT_PERMISSIONS: 'genericLater',

    // Validation Errors
    VALIDATION_FAILED: 'validationFailed',
    VALIDATION_FIELD_REQUIRED: 'fieldRequired',
    VALIDATION_FIELD_INVALID: 'fieldInvalid',
    VALIDATION_FORMAT_INVALID: 'formatInvalid',
    VALIDATION_LENGTH_INVALID: 'lengthInvalid',
    VALIDATION_RANGE_INVALID: 'rangeInvalid',
    VALIDATION_UNIQUE_CONSTRAINT: 'uniqueConstraint',

    // Resource Errors
    RESOURCE_NOT_FOUND: 'resourceNotFound',
    RESOURCE_ALREADY_EXISTS: 'resourceAlreadyExists',
    RESOURCE_CONFLICT: 'resourceConflict',
    RESOURCE_GONE: 'resourceGone',
    RESOURCE_LOCKED: 'resourceLocked',

    // Business Logic Errors
    BUSINESS_RULE_VIOLATION: 'businessRuleViolation',
    BUSINESS_STATE_INVALID: 'businessStateInvalid',
    BUSINESS_OPERATION_NOT_ALLOWED: 'operationNotAllowed',
    BUSINESS_QUOTA_EXCEEDED: 'quotaExceeded',
    BUSINESS_FEATURE_DISABLED: 'featureDisabled',

    // Rate Limiting Errors
    RATE_LIMIT_EXCEEDED: 'rateLimitExceeded',
    RATE_LIMIT_IP_BLOCKED: 'rateLimitBlocked',
    RATE_LIMIT_USER_BLOCKED: 'rateLimitBlocked',
    RATE_LIMIT_API_KEY_BLOCKED: 'rateLimitBlocked',

    // Service Errors
    SERVICE_UNAVAILABLE: 'serviceUnavailable',
    SERVICE_TIMEOUT: 'serviceTimeout',
    SERVICE_MAINTENANCE: 'serviceMaintenance',
    SERVICE_OVERLOADED: 'serviceOverloaded',

    // Network/Offline Errors
    NETWORK_ERROR: 'offline',
    CIRCUIT_OPEN: 'offline',
    CIRCUIT_HALF_OPEN: 'reconnecting',

    // Email Errors
    EMAIL_ALREADY_EXISTS: 'emailAlreadyExists',

    // Query Complexity Errors
    QUERY_TOO_COMPLEX: 'genericRetry',
    PAGINATION_LIMIT_EXCEEDED: 'genericRetry',

    // Version Control Errors
    VERSION_CONFLICT: 'versionConflict',

    // Schema-declared codes that had no mapping.
    //
    // Every member of `ErrorCode` and `TopLevelErrorCode` must appear in this
    // table — `__tests__/i18n/errorCodeCoverage.test.ts` enumerates the
    // generated enums and fails on a gap, in the direction that matters. A
    // missing member fell through to `errors.codes.unexpected`, so a user who
    // hit a not-found, a conflict, a quota or a duplicate read "An unexpected
    // error occurred" while localized copy for exactly that case already
    // shipped, unreachable.
    //
    // (The table is deliberately WIDER than the two enums: `NETWORK_ERROR`,
    // `CIRCUIT_OPEN`, the `BUSINESS_*` and `RATE_LIMIT_*` families and the
    // client's own `SERVICE_TIMEOUT` are raised on this side and have no SDL
    // to be declared in. Only the missing direction is an error.)
    NOT_FOUND: 'resourceNotFound',
    CONFLICT: 'resourceConflict',
    UNIT_INVALID: 'unitInvalid',
    EMAIL_ALREADY_VERIFIED: 'emailAlreadyVerified',
    UNAUTHENTICATED: 'signInRequired',
    BAD_REQUEST: 'validationFailed',
    CLIENT_UPGRADE_REQUIRED: 'clientUpgradeRequired',
    HOME_NOT_A_MEMBER: 'homeAccessDenied',
    OPERATION_RATE_LIMITED: 'rateLimitExceeded',
    RESOURCE_VERSION_CONFLICT: 'versionConflict',
    WS_OPERATION_NOT_ALLOWED: 'operationNotAllowed',
    INTERNAL_SERVER_ERROR: 'genericLater',
    // Transient server-side conditions: the same request is worth retrying.
    DEADLOCK: 'genericRetry',
    DB_CONSTRAINT_VIOLATION: 'genericRetry',
    PAGINATION_FANOUT_EXCEEDED: 'genericRetry',
    SUBSCRIPTION_ERROR: 'genericRetry',
    SUBSCRIPTION_FILTER_ERROR: 'genericRetry',
    SUBSCRIPTION_LIMIT_EXCEEDED: 'genericRetry',
    // Should never be DISPLAYED — both classifiers treat it as converged, so
    // reaching a message means something upstream stopped doing that. Mapped so
    // the table stays total rather than because the string is expected.
    IDEMPOTENT_REPLAY: 'genericRetry',

    // Pantry Errors
    PANTRY_ITEM_ALREADY_EXISTS: 'pantryItemAlreadyExists',

    // Application-Specific Errors
    SHOPPING_LIST_NOT_FOUND: 'shoppingListNotFound',
    SHOPPING_ITEM_NOT_FOUND: 'shoppingItemNotFound',
    SHOPPING_ITEM_ALREADY_EXISTS: 'shoppingItemAlreadyExists',
    HOME_NOT_FOUND: 'homeNotFound',
    HOME_ACCESS_DENIED: 'homeAccessDenied',
    HOME_INVITE_INVALID: 'homeInviteInvalid',
    HOME_INVITE_EXPIRED: 'homeInviteExpired',
    HOME_MEMBER_ALREADY_EXISTS: 'homeMemberAlreadyExists',
  };

  // SERVICE_TIMEOUT and SERVICE_OVERLOADED are in the API's internal registry
  // but absent from the published TopLevelErrorCode enum, which admits a code
  // only once something emits it — so they stay literals, kept defensively.
  private static readonly RETRYABLE_ERRORS: string[] = [
    TopLevelErrorCode.ServiceUnavailable,
    'SERVICE_TIMEOUT',
    'SERVICE_OVERLOADED',
    TopLevelErrorCode.RateLimitExceeded,
    TopLevelErrorCode.AuthTokenExpired,
    TopLevelErrorCode.AuthRefreshTokenSuperseded,
  ];

  // Expected user-input / business-rule outcomes — normal UX, not system
  // faults. These are logged at warn level and kept out of app_errors_total so
  // the error dashboards aren't polluted by routine validation results (e.g. a
  // user signing up with an email that's already taken). Any VALIDATION_* code
  // is also treated as expected (see isExpectedUserError).
  // Both channels are represented because this is asked of whatever code was
  // parsed out: ErrorCode.* for a result-union member, TopLevelErrorCode.* for
  // an `extensions.code`. The SHOPPING_* / HOME_* codes are in neither enum —
  // the API's registry defines them but nothing emits them — so they stay
  // literals, kept defensively.
  private static readonly EXPECTED_USER_ERRORS = new Set<string>([
    ErrorCode.EmailAlreadyExists,
    ErrorCode.VersionConflict,
    ErrorCode.ResourceAlreadyExists,
    ErrorCode.PantryItemAlreadyExists,
    TopLevelErrorCode.ResourceConflict,
    TopLevelErrorCode.ResourceVersionConflict,
    'SHOPPING_ITEM_ALREADY_EXISTS',
    'HOME_MEMBER_ALREADY_EXISTS',
    'HOME_INVITE_INVALID',
    'HOME_INVITE_EXPIRED',
  ]);

  private static readonly ERROR_CATEGORIES: Record<string, string> = {
    AUTH_: 'Authentication',
    // The two Apollo-standard codes carry no category prefix, so they are
    // listed in full. An 'AUTHZ_' prefix would select nothing — that family is
    // retired — while implying codes that no longer exist.
    [TopLevelErrorCode.Unauthenticated]: 'Authentication',
    [TopLevelErrorCode.Forbidden]: 'Authorization',
    API_: 'API Key',
    VALIDATION_: 'Validation',
    RESOURCE_: 'Resource',
    BUSINESS_: 'Business Logic',
    RATE_: 'Rate Limiting',
    SERVICE_: 'Service',
    NETWORK_: 'Network',
    CIRCUIT_: 'Circuit Breaker',
    EMAIL_: 'Email',
    PANTRY_: 'Pantry',
    SHOPPING_: 'Shopping',
    HOME_: 'Home Management',
  };

  getUserFriendlyMessage(errorCode: string, fallbackMessage?: string): string {
    const suffix = ErrorService.ERROR_MESSAGE_KEY_SUFFIXES[errorCode];
    // An unmapped code falls back to the server's own message, which is at
    // least accurate even though it arrives untranslated.
    if (!suffix) return fallbackMessage || t('errors.codes.unexpected');
    // The table holds suffixes; the whole key is composed here.
    return t(`errors.codes.${suffix}`, fallbackMessage);
  }

  getErrorCategory(errorCode: string): string {
    for (const [prefix, category] of Object.entries(
      ErrorService.ERROR_CATEGORIES,
    )) {
      if (errorCode.startsWith(prefix)) {
        return category;
      }
    }
    return 'Unknown';
  }

  shouldRetry(errorCode: string): boolean {
    return ErrorService.RETRYABLE_ERRORS.includes(errorCode);
  }

  isAuthError(errorCode: string): boolean {
    return (
      errorCode.startsWith('AUTH_') ||
      errorCode === TopLevelErrorCode.Unauthenticated
    );
  }

  isExpectedUserError(errorCode: string): boolean {
    return (
      errorCode.startsWith('VALIDATION_') ||
      ErrorService.EXPECTED_USER_ERRORS.has(errorCode)
    );
  }

  /**
   * Report a non-Apollo error to telemetry and console.
   * Use this to replace scattered console.error calls so errors flow to Loki.
   */
  reportError(
    error: unknown,
    context?: { operation?: string; [key: string]: unknown },
  ): void {
    const operation = context?.operation || 'Unknown';
    const serialized = serializeError(error);

    if (__DEV__) {
      logger.error(`[ErrorService] ${operation}:`, serialized);
    }

    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = 'Unknown error';
    }

    Telemetry.trackError(errorMessage, {
      component: 'reported',
      operation,
      serialized_error: JSON.stringify(serialized),
      ...context,
    });
  }

  /**
   * Parse Apollo error into structured result
   */
  parseApolloError(
    error: unknown,
    config: ErrorConfig = {},
  ): ErrorResult<never> {
    const { operation = 'Unknown', customMessage, logError = true } = config;

    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'An unexpected error occurred';
    let validationErrors: Record<string, string> | undefined;

    try {
      // Check for query complexity errors first
      if (isQueryComplexityError(error)) {
        errorCode = 'QUERY_TOO_COMPLEX';
        errorMessage = getQueryComplexityMessage(error);
      }
      // Check for version conflict errors
      else if (isVersionConflictError(error)) {
        errorCode = ErrorCode.VersionConflict;
        errorMessage = getVersionConflictMessage();
      }
      // Apollo error types
      else if (CombinedGraphQLErrors.is(error)) {
        const graphQLError = error.errors[0];
        if (graphQLError) {
          errorCode =
            (graphQLError.extensions?.code as string) || 'GRAPHQL_ERROR';
          errorMessage = graphQLError.message;

          if (
            errorCode === ErrorCode.ValidationFailed &&
            graphQLError.extensions?.validationErrors
          ) {
            validationErrors = graphQLError.extensions
              .validationErrors as Record<string, string>;
          }
        }
      } else if (ServerError.is(error)) {
        const statusCode = error.statusCode;
        if (statusCode === 401) errorCode = TopLevelErrorCode.AuthTokenInvalid;
        // Only reached when the body wasn't a GraphQL envelope, so there is no
        // `extensions.code` to read and the status is all we have. Four
        // different conditions share 403 — FORBIDDEN, AUTH_EMAIL_NOT_VERIFIED,
        // AUTH_ACCOUNT_SUSPENDED and API_KEY_INSUFFICIENT_PERMISSIONS — so this
        // resolves to the generic authorization code rather than guessing.
        // Deliberately not an AUTH_* code: isAuthError() must stay false here,
        // or a key-provisioning fault gets handled as a dead session.
        else if (statusCode === 403) errorCode = TopLevelErrorCode.Forbidden;
        else if (statusCode === 404)
          errorCode = TopLevelErrorCode.ResourceNotFound;
        else if (statusCode === 429)
          errorCode = TopLevelErrorCode.RateLimitExceeded;
        else if (statusCode >= 500)
          errorCode = TopLevelErrorCode.ServiceUnavailable;
        else errorCode = 'NETWORK_ERROR';

        errorMessage = error.message || `Unable to connect (${statusCode}).`;
      } else if (ServerParseError.is(error)) {
        errorCode = TopLevelErrorCode.ServiceUnavailable;
        errorMessage = 'Server response could not be parsed';
      } else if (CombinedProtocolErrors.is(error)) {
        errorCode = 'NETWORK_ERROR';
        errorMessage = error.message || 'Unable to connect.';
      }
      // A refusal that `unwrapPayload` turned into a throw. It carries the
      // server's own `code`, and this branch is what keeps it: without it the
      // error fell through to the plain `instanceof Error` arm below, `errorCode`
      // stayed at its 'UNKNOWN_ERROR' initializer, and every domain refusal
      // reaching a caller by throw — a quota, a duplicate, a version conflict —
      // resolved to "An unexpected error occurred". It must be tested BEFORE
      // `instanceof Error`, which it also satisfies.
      else if (error instanceof GraphQLDomainError) {
        errorCode = error.code;
        errorMessage = error.message;
      } else if (error instanceof GraphQLNetworkError) {
        errorCode = 'NETWORK_ERROR';
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      const category = this.getErrorCategory(errorCode);
      const userFriendlyMessage =
        customMessage || this.getUserFriendlyMessage(errorCode, errorMessage);

      const isExpectedUserError = this.isExpectedUserError(errorCode);

      if (logError) {
        if (isExpectedUserError) {
          logger.warn(`Validation error in ${operation}:`, {
            code: errorCode,
            message: errorMessage,
          });
        } else {
          logger.error(`Error in ${operation}:`, {
            code: errorCode,
            message: errorMessage,
            originalError: serializeError(error),
          });
        }
      }

      // Report to telemetry so errors flow to Loki in production. Expected
      // user-input outcomes go to warn level and skip app_errors_total; only
      // genuine faults are tracked as errors.
      if (isExpectedUserError) {
        Telemetry.warn(`Validation: ${errorCode} in ${operation}`, {
          component: category,
          operation,
          code: errorCode,
        });
      } else {
        Telemetry.trackError(errorMessage, {
          component: category,
          operation,
          code: errorCode,
          serialized_error: JSON.stringify(serializeError(error)),
        });
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: userFriendlyMessage,
          category,
          shouldRetry: this.shouldRetry(errorCode),
          isAuthError: this.isAuthError(errorCode),
          validationErrors,
        },
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'ERROR_HANDLER_FAILED',
          message: t('errors.codes.genericRetry'),
          category: 'Unknown',
          shouldRetry: false,
          isAuthError: false,
        },
      };
    }
  }

  /**
   * Handle an Apollo error and return a flat result.
   * Drop-in replacement for the legacy ErrorHandler.handleApolloError().
   */
  handleApolloError(
    error: unknown,
    config: ErrorConfig = {},
  ): ApolloErrorResult {
    const result = this.parseApolloError(error, config);
    return (
      result.error || {
        code: 'UNKNOWN_ERROR',
        message: t('errors.codes.unexpected'),
        category: 'Unknown',
        shouldRetry: false,
        isAuthError: false,
      }
    );
  }

  /**
   * Wrap a mutation with error handling
   * Returns structured result instead of throwing
   */
  async handleMutation<T>(
    fn: () => Promise<T>,
    config: ErrorConfig = {},
  ): Promise<ErrorResult<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      return this.parseApolloError(error, config);
    }
  }

  /**
   * Wrap a mutation with version conflict handling
   * Returns structured result with version conflict flag
   */
  async handleMutationWithVersionConflict<T>(
    fn: () => Promise<T>,
    config: ErrorConfig = {},
  ): Promise<ErrorResult<T> & { isVersionConflict?: boolean }> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const result = this.parseApolloError(error, config);
      return {
        ...result,
        isVersionConflict: result.error?.code === ErrorCode.VersionConflict,
      };
    }
  }
}

// Export singleton instance
export const errorService = new ErrorService();

/**
 * What to SHOW a user when a mutation fails.
 *
 * Resolved from the error's CODE through `errors.codes.*`, never from the
 * server's message. The server's text is unlocalizable English by construction,
 * and it reaches users verbatim otherwise: an Albanian-locale user pressing
 * "move to pantry" against an unmigrated database saw a "Gabim" alert whose
 * body read "An unexpected database error occurred".
 *
 * An unmapped code lands on the caller's `fallback` — or on
 * `errors.codes.unexpected` when there is none — rather than on that text. A
 * vaguer sentence in the right language beats a precise one in the wrong one,
 * and the precise version is in the log either way.
 *
 * `fallback` must itself be localized: it is the caller's own copy for what
 * failed ("Couldn't update the home name"), which is more useful than a generic
 * sentence wherever the site knows what it was doing.
 */
export const localizedErrorMessage = (
  error: unknown,
  fallback?: string,
): string => {
  const result = errorService.parseApolloError(error, { logError: false });
  const code = result.error?.code;
  if (!code) return fallback ?? t('errors.codes.unexpected');
  return errorService.getUserFriendlyMessage(code, fallback);
};

/**
 * Pure extraction of a raw error message from an `unknown` value, with a
 * caller-supplied fallback. Unlike `localizedErrorMessage`, this does NOT map a
 * code to user-facing copy or emit telemetry — use it at logging/handler sites
 * that already have their own fallback copy and just need the raw message
 * (replaces the repeated `(error as any)?.message || fallback` pattern).
 */
export const errorMessageOr = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
};

// Export hook for use in components
// Returns an object matching the legacy useErrorHandler shape for easy migration
export const useErrorService = () => {
  return {
    handleApolloError: errorService.handleApolloError.bind(errorService),
    parseApolloError: errorService.parseApolloError.bind(errorService),
    handleMutation: errorService.handleMutation.bind(errorService),
    handleMutationWithVersionConflict:
      errorService.handleMutationWithVersionConflict.bind(errorService),
    getUserFriendlyMessage:
      errorService.getUserFriendlyMessage.bind(errorService),
    getErrorCategory: errorService.getErrorCategory.bind(errorService),
    shouldRetry: errorService.shouldRetry.bind(errorService),
    isAuthError: errorService.isAuthError.bind(errorService),
    reportError: errorService.reportError.bind(errorService),
  };
};
