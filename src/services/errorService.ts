/**
 * Unified error handling: parses Apollo and non-Apollo errors into a typed
 * result with telemetry attached, rather than showing anything itself.
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

/** Flat variant of {@link ErrorResult}'s error branch. */
export interface ApolloErrorResult {
  code: string;
  message: string;
  category: string;
  shouldRetry: boolean;
  isAuthError: boolean;
  validationErrors?: Record<string, string>;
}

export interface ErrorConfig {
  operation?: string;
  customMessage?: string;
  logError?: boolean;
}

export class ErrorService {
  /**
   * Error code → i18n key SUFFIX, composed as `errors.codes.<suffix>` by
   * {@link getUserFriendlyMessage}. Suffixes, not resolved strings: this is a
   * static field, so calling `t()` here would freeze the language active at
   * module load. Codes warranting the same sentence share a suffix.
   */
  private static readonly ERROR_MESSAGE_KEY_SUFFIXES: Record<string, string> = {
    // Authentication Errors
    AUTH_TOKEN_MISSING: 'signInRequired',
    AUTH_TOKEN_INVALID: 'sessionInvalid',
    AUTH_TOKEN_EXPIRED: 'sessionExpired',
    AUTH_REFRESH_TOKEN_MISSING: 'sessionEnded',
    AUTH_REFRESH_TOKEN_INVALID: 'sessionEnded',
    // Its own sentence: the exchange lost a rotation race, the session is alive
    // and the refresh path recovers on its own. 'sessionExpired'/'sessionEnded'
    // both read "Please sign in again", which would be wrong here.
    AUTH_REFRESH_TOKEN_SUPERSEDED: 'sessionRetrying',
    AUTH_CREDENTIALS_INVALID: 'credentialsInvalid',
    AUTH_ACCOUNT_LOCKED: 'accountLocked',
    // Distinct from the lockout above: a moderation decision, not a window that
    // expires, so the copy points at support rather than inviting a retry.
    AUTH_ACCOUNT_SUSPENDED: 'accountSuspended',
    AUTH_EMAIL_NOT_VERIFIED: 'emailNotVerified',
    // Permanently useless, and uniform across every reason on purpose —
    // which one applied is not disclosed. The client clears the stored
    // credential and falls back to the password screen.
    AUTH_DEVICE_CREDENTIAL_INVALID: 'deviceCredentialInvalid',

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

    // Every member of `ErrorCode` and `TopLevelErrorCode` must appear in this
    // table, or its message falls through to `errors.codes.unexpected` while
    // localized copy for the case sits unreachable;
    // `__tests__/i18n/errorCodeCoverage.test.ts` fails on a gap. The table is
    // deliberately WIDER than the enums — client-raised codes have no SDL to be
    // declared in — so only the missing direction is an error.
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
    // Should never be DISPLAYED: both classifiers treat it as converged. Mapped
    // only to keep the table total.
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

  // Expected user-input outcomes: logged at warn and kept out of
  // app_errors_total. Any VALIDATION_* code counts too (see
  // isExpectedUserError). Both code channels appear because this is asked of
  // whatever was parsed out; the SHOPPING_*/HOME_* literals are in neither enum.
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
    // The two Apollo-standard codes carry no category prefix, so they are listed
    // in full. There is no 'AUTHZ_' family to prefix-match.
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

  /** Report a non-Apollo error to telemetry and console, so it reaches Loki. */
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
      serialized_error: serialized,
      ...context,
    });
  }

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
        // No GraphQL envelope here, so the status is all there is, and four
        // conditions share 403. Deliberately NOT an AUTH_* code: isAuthError()
        // must stay false, or a key-provisioning fault reads as a dead session.
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
      // A refusal `unwrapPayload` turned into a throw; it carries the server's
      // own `code`. MUST be tested before the `instanceof Error` arm, which it
      // also satisfies, or every thrown domain refusal reads as UNKNOWN_ERROR.
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

      // Expected user-input outcomes go to warn and skip app_errors_total.
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
          serialized_error: serializeError(error),
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

  /** {@link parseApolloError}, flattened to the error branch. */
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

  /** Wrap a mutation so a throw becomes a structured result. */
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

  /** {@link handleMutation} plus an `isVersionConflict` flag. */
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

export const errorService = new ErrorService();

/**
 * What to SHOW a user when a mutation fails: resolved from the error CODE
 * through `errors.codes.*`, never the server's message (unlocalizable English).
 * An unmapped code lands on the caller's localized `fallback`. A TRANSPORT code
 * also yields to it — that copy is written for a read, and on a write is untrue.
 */
const TRANSPORT_CODES = new Set(['NETWORK_ERROR', 'CIRCUIT_OPEN']);

export const localizedErrorMessage = (
  error: unknown,
  fallback?: string,
): string => {
  const result = errorService.parseApolloError(error, { logError: false });
  const code = result.error?.code;
  if (!code) return fallback ?? t('errors.codes.unexpected');
  if (fallback && TRANSPORT_CODES.has(code)) return fallback;
  return errorService.getUserFriendlyMessage(code, fallback);
};

// Hook form for components.
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
