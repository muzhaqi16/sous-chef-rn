/**
 * Error Service - Unified error handling for the application
 *
 * This service provides:
 * 1. Structured error parsing (from errorHandling.ts)
 * 2. Error wrapper functions (from errorHandlers.ts)
 * 3. Returns typed results instead of showing alerts
 * 4. Works with toast/snackbar service for user feedback
 *
 * Usage:
 * ```typescript
 * const result = errorService.handleMutation(() => mutation(), 'Update Item');
 * if (!result.success) {
 *   toastService.error(result.message);
 *   return;
 * }
 * ```
 */

import { logger } from '#/utils/environment';
import { serializeError } from '#/utils/errorSerialization';
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

/**
 * Result type for error operations
 */
export interface ErrorResult<T = any> {
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
 * Configuration for error handling
 */
export interface ErrorConfig {
  operation?: string;
  customMessage?: string;
  logError?: boolean;
}

class ErrorService {
  private static readonly ERROR_MESSAGES: Record<string, string> = {
    // Authentication Errors
    AUTH_TOKEN_MISSING: 'Please sign in to continue',
    AUTH_TOKEN_INVALID: 'Your session is invalid. Please sign in again',
    AUTH_TOKEN_EXPIRED: 'Your session has expired. Please sign in again',
    AUTH_REFRESH_TOKEN_MISSING: 'Session expired. Please sign in again',
    AUTH_REFRESH_TOKEN_INVALID: 'Session expired. Please sign in again',
    AUTH_CREDENTIALS_INVALID: 'Invalid email or password',
    AUTH_ACCOUNT_LOCKED:
      'Your account has been temporarily locked for security',
    AUTH_EMAIL_NOT_VERIFIED: 'Please verify your email before continuing',

    // Authorization Errors
    AUTHZ_FORBIDDEN: "You don't have permission to perform this action",
    AUTHZ_INSUFFICIENT_PERMISSIONS: "You don't have sufficient permissions",
    AUTHZ_RESOURCE_ACCESS_DENIED: 'Access denied to this resource',
    AUTHZ_ADMIN_REQUIRED: 'Administrator privileges required',
    AUTHZ_MODERATOR_REQUIRED: 'Moderator privileges required',

    // Validation Errors
    VALIDATION_FAILED: 'Please check your input and try again',
    VALIDATION_FIELD_REQUIRED: 'Required field is missing',
    VALIDATION_FIELD_INVALID: 'Invalid field value',
    VALIDATION_FORMAT_INVALID: 'Invalid format',
    VALIDATION_LENGTH_INVALID: 'Input length is invalid',
    VALIDATION_RANGE_INVALID: 'Value is outside allowed range',
    VALIDATION_UNIQUE_CONSTRAINT: 'This value already exists',

    // Resource Errors
    RESOURCE_NOT_FOUND: 'The requested item was not found',
    RESOURCE_ALREADY_EXISTS: 'This resource already exists',
    RESOURCE_CONFLICT: "There's a conflict with this operation",
    RESOURCE_GONE: 'This item is no longer available',
    RESOURCE_LOCKED: 'This item is currently locked and cannot be modified',

    // Business Logic Errors
    BUSINESS_RULE_VIOLATION: 'This action violates business rules',
    BUSINESS_STATE_INVALID: 'Invalid state for this operation',
    BUSINESS_OPERATION_NOT_ALLOWED: 'This operation is not allowed',
    BUSINESS_QUOTA_EXCEEDED: "You've exceeded your quota limit",
    BUSINESS_FEATURE_DISABLED: 'This feature is currently disabled',

    // Rate Limiting Errors
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
    RATE_LIMIT_IP_BLOCKED: 'Your IP has been rate limited',
    RATE_LIMIT_USER_BLOCKED: 'Your account has been rate limited',

    // Service Errors
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
    SERVICE_TIMEOUT: 'Request timed out. Please try again',
    SERVICE_MAINTENANCE: 'Service is under maintenance',
    SERVICE_OVERLOADED: 'Service is overloaded. Please try again later',

    // Network/Offline Errors
    NETWORK_ERROR:
      "You're currently offline. Showing cached data when available.",
    CIRCUIT_OPEN:
      "You're currently offline. Showing cached data when available.",
    CIRCUIT_HALF_OPEN: 'Reconnecting... You may see cached data.',

    // Query Complexity Errors
    QUERY_TOO_COMPLEX: 'Query is too complex. Please simplify your request.',
    PAGINATION_LIMIT_EXCEEDED:
      'Too many items requested. Maximum is 100 items per request.',

    // Version Control Errors
    VERSION_CONFLICT:
      'This item was updated by another user. Please refresh and try again.',

    // Application-Specific Errors
    SHOPPING_LIST_NOT_FOUND: 'Shopping list not found',
    SHOPPING_LIST_ACCESS_DENIED: "You don't have access to this shopping list",
    HOME_NOT_FOUND: 'Home not found',
    HOME_ACCESS_DENIED: "You don't have access to this home",
    HOME_INVITE_INVALID: 'Invalid home invitation',
    HOME_INVITE_EXPIRED: 'Home invitation has expired',
  };

  private static readonly RETRYABLE_ERRORS = [
    'SERVICE_UNAVAILABLE',
    'SERVICE_TIMEOUT',
    'SERVICE_OVERLOADED',
    'RATE_LIMIT_EXCEEDED',
    'AUTH_TOKEN_EXPIRED',
  ];

  private static readonly ERROR_CATEGORIES: Record<string, string> = {
    AUTH_: 'Authentication',
    AUTHZ_: 'Authorization',
    VALIDATION_: 'Validation',
    RESOURCE_: 'Resource',
    BUSINESS_: 'Business Logic',
    RATE_: 'Rate Limiting',
    SERVICE_: 'Service',
    NETWORK_: 'Network',
    CIRCUIT_: 'Circuit Breaker',
    SHOPPING_: 'Shopping',
    HOME_: 'Home Management',
  };

  getUserFriendlyMessage(errorCode: string, fallbackMessage?: string): string {
    return (
      ErrorService.ERROR_MESSAGES[errorCode] ||
      fallbackMessage ||
      'An unexpected error occurred'
    );
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
    return errorCode.startsWith('AUTH_') || errorCode.startsWith('AUTHZ_');
  }

  /**
   * Parse Apollo error into structured result
   */
  parseApolloError(error: unknown, config: ErrorConfig = {}): ErrorResult {
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
        errorCode = 'VERSION_CONFLICT';
        errorMessage = getVersionConflictMessage(error);
      }
      // Apollo error types
      else if (CombinedGraphQLErrors.is(error)) {
        const graphQLError = error.errors[0];
        if (graphQLError) {
          errorCode =
            (graphQLError.extensions?.code as string) || 'GRAPHQL_ERROR';
          errorMessage = graphQLError.message;

          if (
            errorCode === 'VALIDATION_FAILED' &&
            graphQLError.extensions?.validationErrors
          ) {
            validationErrors = graphQLError.extensions
              .validationErrors as Record<string, string>;
          }
        }
      } else if (ServerError.is(error)) {
        const statusCode = error.statusCode;
        if (statusCode === 401) errorCode = 'AUTH_TOKEN_INVALID';
        else if (statusCode === 403) errorCode = 'AUTHZ_FORBIDDEN';
        else if (statusCode === 404) errorCode = 'RESOURCE_NOT_FOUND';
        else if (statusCode === 429) errorCode = 'RATE_LIMIT_EXCEEDED';
        else if (statusCode >= 500) errorCode = 'SERVICE_UNAVAILABLE';
        else errorCode = 'NETWORK_ERROR';

        errorMessage = error.message || `Unable to connect (${statusCode}).`;
      } else if (ServerParseError.is(error)) {
        errorCode = 'SERVICE_UNAVAILABLE';
        errorMessage = 'Server response could not be parsed';
      } else if (CombinedProtocolErrors.is(error)) {
        errorCode = 'NETWORK_ERROR';
        errorMessage = error.message || 'Unable to connect.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      const userFriendlyMessage =
        customMessage || this.getUserFriendlyMessage(errorCode, errorMessage);

      if (logError) {
        logger.error(`Error in ${operation}:`, {
          code: errorCode,
          message: errorMessage,
          originalError: serializeError(error),
        });
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: userFriendlyMessage,
          category: this.getErrorCategory(errorCode),
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
          message: 'Something went wrong. Please try again.',
          category: 'Unknown',
          shouldRetry: false,
          isAuthError: false,
        },
      };
    }
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
        isVersionConflict: result.error?.code === 'VERSION_CONFLICT',
      };
    }
  }
}

// Export singleton instance
export const errorService = new ErrorService();

// Export hook for use in components
export const useErrorService = () => errorService;
