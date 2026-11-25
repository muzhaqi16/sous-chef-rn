/**
 * Unified error handling: parses Apollo and non-Apollo errors into a typed
 * result with telemetry attached, rather than showing anything itself.
 */

import { ErrorCode, TopLevelErrorCode } from '#graphql/generated/schemaTypes';
import { logger } from '#utils/environment';
import { isNetworkError } from '#utils/isNetworkError';
import { serializeError } from '#utils/errorSerialization';
import { firstNonBlank } from '#utils/firstNonBlank';
import { isOwnKey } from '#utils/isOwnKey';
import {
  GraphQLNetworkError,
  refusalEnvelopeOf,
} from '#utils/errors/graphqlErrors';
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
  ServerParseError,
} from '@apollo/client/errors';
import {
  isQueryComplexityError,
  describeQueryComplexity,
} from '#utils/errors/queryComplexity';
import {
  isVersionConflictError,
  getVersionConflictMessage,
} from '#utils/errors/versionConflict';
import { Telemetry } from '#services/telemetry';
import { t, type KeyUnder } from '#i18n';
import type { Translate } from '#i18n/types';

export interface ErrorResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    isAuthError: boolean;
    validationErrors?: Record<string, string>;
  };
}

/** Flat variant of {@link ErrorResult}'s error branch. */
export interface ApolloErrorResult {
  code: string;
  message: string;
  isAuthError: boolean;
  validationErrors?: Record<string, string>;
}

export interface ErrorConfig {
  operation?: string;
  customMessage?: string;
  logError?: boolean;
}

// The server sends `validationErrors` as a field → message map; a non-string
// entry is not a message this client can show.
function toValidationErrors(
  value: unknown,
): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const messages: Record<string, string> = {};
  for (const [field, message] of Object.entries(value)) {
    if (typeof message === 'string') messages[field] = message;
  }
  return messages;
}

/** Every code the server can send: the two generated enums. */
type ServerErrorCode = `${ErrorCode}` | `${TopLevelErrorCode}`;
/** Codes this client raises itself, which have no SDL. */
type ClientErrorCode = 'NETWORK_ERROR' | 'CIRCUIT_OPEN' | 'CIRCUIT_HALF_OPEN';

export class ErrorService {
  /**
   * Error code → `errors.codes.<suffix>`. Suffixes, not strings: `t()` in a
   * static field would freeze the language active at module load. Typed by
   * the generated enums, so a code nothing sends does not compile and a new
   * one without a sentence fails typecheck.
   */
  private static readonly ERROR_MESSAGE_KEY_SUFFIXES = {
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
    API_KEY_INSUFFICIENT_PERMISSIONS: 'genericLater',

    // Validation Errors
    VALIDATION_FAILED: 'validationFailed',
    VALIDATION_UNIQUE_CONSTRAINT: 'uniqueConstraint',

    // Resource Errors
    RESOURCE_NOT_FOUND: 'resourceNotFound',
    RESOURCE_CONFLICT: 'resourceConflict',

    // Rate Limiting Errors
    RATE_LIMIT_EXCEEDED: 'rateLimitExceeded',

    // Service Errors
    SERVICE_UNAVAILABLE: 'serviceUnavailable',

    // Network/Offline Errors
    NETWORK_ERROR: 'offline',
    CIRCUIT_OPEN: 'offline',
    CIRCUIT_HALF_OPEN: 'reconnecting',

    // Query Complexity Errors
    PAGINATION_LIMIT_EXCEEDED: 'genericRetry',

    // Version Control Errors
    VERSION_CONFLICT: 'versionConflict',

    NOT_FOUND: 'resourceNotFound',
    CONFLICT: 'resourceConflict',
    UNIT_INVALID: 'unitInvalid',
    UNSTATED_AMOUNT: 'unstatedAmount',
    FEATURE_DISABLED: 'featureDisabled',
    PREMIUM_REQUIRED: 'premiumRequired',
    UNAUTHENTICATED: 'signInRequired',
    BAD_REQUEST: 'validationFailed',
    CLIENT_UPGRADE_REQUIRED: 'clientUpgradeRequired',
    HOME_NOT_A_MEMBER: 'homeAccessDenied',
    // Told to the one refused at a join door; an inviter's copy is the invite's own.
    HOME_MEMBERSHIP_REMOVED: 'homeMembershipRemoved',
    HOME_MEMBERSHIP_SUSPENDED: 'homeMembershipSuspended',
    OPERATION_RATE_LIMITED: 'rateLimitExceeded',
    RESOURCE_VERSION_CONFLICT: 'versionConflict',
    WS_OPERATION_NOT_ALLOWED: 'operationNotAllowed',
    // Refused before execution: the request is larger than the server reads.
    PAYLOAD_TOO_LARGE: 'payloadTooLarge',
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
    INSUFFICIENT_QUANTITY: 'insufficientQuantity',
    UNIT_CHANGE_NEEDS_RESOLUTION: 'unitChangeNeedsResolution',

    // Application-Specific Errors
    HOME_ACCESS_DENIED: 'homeAccessDenied',
    HOME_MEMBER_LIMIT_REACHED: 'homeMemberLimitReached',
  } satisfies Record<
    ServerErrorCode | ClientErrorCode,
    KeyUnder<'errors.codes'>
  >;

  // Codes arrive as plain strings, so these are typed `string`.
  private static readonly UNAUTHENTICATED: string =
    TopLevelErrorCode.Unauthenticated;
  private static readonly VALIDATION_FAILED: string =
    ErrorCode.ValidationFailed;

  // The server's own availability rule (`isServiceFault`): every code it can
  // send is a refusal the user acts on, logged at warn and kept out of
  // app_errors_total, except these faults. A code it never sends (the
  // client's NETWORK_ERROR, UNKNOWN_ERROR) is no user's error either.
  private static readonly SERVICE_FAULTS = new Set<string>([
    ErrorCode.InternalServerError,
    TopLevelErrorCode.InternalServerError,
    TopLevelErrorCode.ServiceUnavailable,
    TopLevelErrorCode.SubscriptionError,
    TopLevelErrorCode.SubscriptionFilterError,
  ]);

  // BAD_USER_INPUT is Apollo's, passed through for a malformed typed value.
  // Its other codes (a parse or validation failure) mean a broken build, and
  // stay faults.
  private static readonly SERVER_CODES = new Set<string>([
    ...Object.values(ErrorCode),
    ...Object.values(TopLevelErrorCode),
    'BAD_USER_INPUT',
  ]);

  /**
   * Whether the app has its own sentence for this code. A caller choosing
   * between the code's copy and something more generic needs to know the code
   * resolves to more than the fallback it was going to use anyway.
   */
  hasUserFriendlyMessage(errorCode: string): boolean {
    return isOwnKey(ErrorService.ERROR_MESSAGE_KEY_SUFFIXES, errorCode);
  }

  getUserFriendlyMessage(errorCode: string, fallbackMessage?: string): string {
    return this.messageForCode(errorCode, t, fallbackMessage);
  }

  /** {@link getUserFriendlyMessage} in the language of the caller's `t`. */
  messageForCode(
    errorCode: string,
    translate: Translate,
    fallbackMessage?: string,
  ): string {
    const table = ErrorService.ERROR_MESSAGE_KEY_SUFFIXES;
    // An unmapped code takes the caller's own localized copy; the server's
    // message never reaches here.
    if (!isOwnKey(table, errorCode)) {
      return (
        firstNonBlank(fallbackMessage) ?? translate('errors.codes.unexpected')
      );
    }
    // The table holds suffixes; the whole key is composed here.
    return translate(`errors.codes.${table[errorCode]}`);
  }

  isAuthError(errorCode: string): boolean {
    return (
      errorCode.startsWith('AUTH_') ||
      errorCode === ErrorService.UNAUTHENTICATED
    );
  }

  isExpectedUserError(errorCode: string): boolean {
    return (
      ErrorService.SERVER_CODES.has(errorCode) &&
      !ErrorService.SERVICE_FAULTS.has(errorCode)
    );
  }

  /** Report a non-Apollo error to telemetry and console, so it reaches Loki. */
  reportError(
    error: unknown,
    context?: { operation?: string; [key: string]: unknown },
  ): void {
    const operation = firstNonBlank(context?.operation) ?? 'Unknown';
    const serialized = serializeError(error);

    if (__DEV__) {
      logger.error(`[ErrorService] ${operation}:`, serialized);
    }

    let diagnostic: string;
    if (error instanceof Error) {
      diagnostic = error.message;
    } else if (typeof error === 'string') {
      diagnostic = error;
    } else {
      diagnostic = 'Unknown error';
    }

    Telemetry.trackError(diagnostic, {
      component: 'reported',
      operation,
      serialized_error: serialized,
      ...context,
    });
  }

  /**
   * What a failure is: its code, the text to log for it, and the fields a
   * refusal named. It builds no copy, so it can be read while rendering. A
   * null `diagnostic` is the version conflict's, whose only text is copy.
   */
  private classify(error: unknown): {
    errorCode: string;
    diagnostic: string | null;
    validationErrors: Record<string, string> | undefined;
  } {
    let errorCode = 'UNKNOWN_ERROR';
    let diagnostic: string | null = 'An unexpected error occurred';
    let validationErrors: Record<string, string> | undefined;

    // Check for query complexity errors first
    if (isQueryComplexityError(error)) {
      errorCode = TopLevelErrorCode.PaginationLimitExceeded;
      diagnostic = describeQueryComplexity(error);
    }
    // Check for version conflict errors
    else if (isVersionConflictError(error)) {
      errorCode = ErrorCode.VersionConflict;
      diagnostic = null;
    }
    // Apollo error types
    else if (CombinedGraphQLErrors.is(error)) {
      const graphQLError = error.errors[0];
      if (graphQLError) {
        errorCode =
          (graphQLError.extensions?.code as string) || 'GRAPHQL_ERROR';
        diagnostic = graphQLError.message;

        if (
          errorCode === ErrorService.VALIDATION_FAILED &&
          graphQLError.extensions?.validationErrors
        ) {
          validationErrors = toValidationErrors(
            graphQLError.extensions.validationErrors,
          );
        }
      }
    } else if (ServerError.is(error)) {
      const statusCode = error.statusCode;
      // A refusal before execution carries its code in the body; the status
      // is read only for a body that is not an envelope.
      const envelope = refusalEnvelopeOf(error);
      if (envelope) errorCode = envelope.code;
      else if (statusCode === 401)
        errorCode = TopLevelErrorCode.AuthTokenInvalid;
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

      diagnostic = error.message || `Unable to connect (${statusCode}).`;
    } else if (ServerParseError.is(error)) {
      errorCode = TopLevelErrorCode.ServiceUnavailable;
      diagnostic = 'Server response could not be parsed';
    } else if (CombinedProtocolErrors.is(error)) {
      errorCode = 'NETWORK_ERROR';
      diagnostic = error.message || 'Unable to connect.';
    } else if (error instanceof GraphQLNetworkError) {
      errorCode = 'NETWORK_ERROR';
      diagnostic = error.message;
    } else if (error instanceof Error && isNetworkError(error)) {
      // Before the plain `instanceof Error` arm, which a fetch failure also
      // satisfies: read there it is UNKNOWN_ERROR, "an unexpected error".
      errorCode = 'NETWORK_ERROR';
      diagnostic = error.message;
    } else if (error instanceof Error) {
      diagnostic = error.message;
    } else if (typeof error === 'string') {
      diagnostic = error;
    }

    return { errorCode, diagnostic, validationErrors };
  }

  /** The code a failure carries, with nothing logged and no copy built. */
  codeOf(error: unknown): string {
    try {
      return this.classify(error).errorCode;
    } catch {
      return 'ERROR_HANDLER_FAILED';
    }
  }

  parseApolloError(
    error: unknown,
    config: ErrorConfig = {},
  ): ErrorResult<never> {
    const { operation = 'Unknown', customMessage, logError = true } = config;

    try {
      const classified = this.classify(error);
      const { errorCode, validationErrors } = classified;
      const diagnostic = classified.diagnostic ?? getVersionConflictMessage();

      const userFriendlyMessage =
        firstNonBlank(customMessage) ?? this.getUserFriendlyMessage(errorCode);

      const isExpectedUserError = this.isExpectedUserError(errorCode);

      if (logError) {
        if (isExpectedUserError) {
          logger.warn(`Validation error in ${operation}:`, {
            code: errorCode,
            message: diagnostic,
          });
        } else {
          logger.error(`Error in ${operation}:`, {
            code: errorCode,
            message: diagnostic,
            originalError: serializeError(error),
          });
        }
      }

      // Expected user-input outcomes go to warn and skip app_errors_total.
      if (isExpectedUserError) {
        Telemetry.warn(`Validation: ${errorCode} in ${operation}`, {
          component: errorCode,
          operation,
          code: errorCode,
        });
      } else {
        Telemetry.trackError(diagnostic, {
          component: errorCode,
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
      result.error ?? {
        code: 'UNKNOWN_ERROR',
        message: t('errors.codes.unexpected'),
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
 * A mutation failure shows copy from its CODE, never the server's English; an
 * unmapped code takes the caller's `fallback`, and so does a TRANSPORT code,
 * whose copy is written for a read and untrue for a write.
 */
const TRANSPORT_CODES = new Set(['NETWORK_ERROR', 'CIRCUIT_OPEN']);

/**
 * True unless the SERVER issued this verdict — an unclassified failure cannot
 * be shown to have arrived, so it earns no persisted penalty either. A new
 * unrecognised shape reads as "no verdict" rather than as a lockout.
 */
export const isTransportFailure = (error: unknown): boolean => {
  const code = errorService.parseApolloError(error, { logError: false }).error
    ?.code;
  return !code || code === 'UNKNOWN_ERROR' || TRANSPORT_CODES.has(code);
};

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

/**
 * {@link localizedErrorMessage} for copy read while rendering: resolved with
 * the caller's `t`, so it follows a language change, and with nothing logged.
 */
export const errorCopy = (
  error: unknown,
  translate: Translate,
  fallback?: string,
): string => {
  const code = errorService.codeOf(error);
  if (fallback && TRANSPORT_CODES.has(code)) return fallback;
  return errorService.messageForCode(code, translate, fallback);
};
