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
import { Telemetry } from '#/services/telemetry';

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
    AUTHZ_ADMIN_REQUIRED: "You don't have permission to perform this action.",
    AUTHZ_MODERATOR_REQUIRED:
      "You don't have permission to perform this action.",

    // API Key Errors
    API_KEY_MISSING: 'Something went wrong. Please try again later.',
    API_KEY_INVALID: 'Something went wrong. Please try again later.',
    API_KEY_EXPIRED: 'Something went wrong. Please try again later.',
    API_KEY_REVOKED: 'Something went wrong. Please try again later.',
    API_KEY_RATE_LIMITED: 'Something went wrong. Please try again later.',

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
    BUSINESS_RULE_VIOLATION:
      "This action couldn't be completed. Please try again.",
    BUSINESS_STATE_INVALID:
      "This action couldn't be completed right now. Please try again.",
    BUSINESS_OPERATION_NOT_ALLOWED: "This action isn't available right now.",
    BUSINESS_QUOTA_EXCEEDED: "You've exceeded your quota limit",
    BUSINESS_FEATURE_DISABLED: 'This feature is currently disabled',

    // Rate Limiting Errors
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
    RATE_LIMIT_IP_BLOCKED:
      'Too many requests. Please wait a moment and try again.',
    RATE_LIMIT_USER_BLOCKED:
      'Too many requests. Please wait a moment and try again.',
    RATE_LIMIT_API_KEY_BLOCKED:
      'Too many requests. Please wait a moment and try again.',

    // Service Errors
    SERVICE_UNAVAILABLE: "We're experiencing issues. Please try again shortly.",
    SERVICE_TIMEOUT: 'Request timed out. Please try again',
    SERVICE_MAINTENANCE:
      "We're performing maintenance. Please try again shortly.",
    SERVICE_OVERLOADED:
      "We're experiencing high demand. Please try again shortly.",

    // Network/Offline Errors
    NETWORK_ERROR:
      "You're currently offline. Showing cached data when available.",
    CIRCUIT_OPEN:
      "You're currently offline. Showing cached data when available.",
    CIRCUIT_HALF_OPEN: 'Reconnecting... You may see cached data.',

    // Email Errors
    EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',

    // Query Complexity Errors
    QUERY_TOO_COMPLEX: 'Something went wrong. Please try again.',
    PAGINATION_LIMIT_EXCEEDED: 'Something went wrong. Please try again.',

    // Version Control Errors
    VERSION_CONFLICT:
      'This item was updated by another user. Please refresh and try again.',

    // Pantry Errors
    PANTRY_ITEM_ALREADY_EXISTS: 'This item is already in your pantry',

    // Application-Specific Errors
    SHOPPING_LIST_NOT_FOUND: 'Shopping list not found',
    SHOPPING_LIST_ACCESS_DENIED: "You don't have access to this shopping list",
    SHOPPING_ITEM_NOT_FOUND: 'Shopping item not found',
    SHOPPING_ITEM_ALREADY_EXISTS: 'This item is already in your shopping list',
    HOME_NOT_FOUND: 'Home not found',
    HOME_ACCESS_DENIED: "You don't have access to this home",
    HOME_INVITE_INVALID: 'Invalid home invitation',
    HOME_INVITE_EXPIRED: 'Home invitation has expired',
    HOME_MEMBER_ALREADY_EXISTS: 'User is already a member of this home',
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

      const category = this.getErrorCategory(errorCode);
      const userFriendlyMessage =
        customMessage || this.getUserFriendlyMessage(errorCode, errorMessage);

      if (logError) {
        logger.error(`Error in ${operation}:`, {
          code: errorCode,
          message: errorMessage,
          originalError: serializeError(error),
        });
      }

      // Report to telemetry so errors flow to Loki in production
      Telemetry.trackError(errorMessage, {
        component: category,
        operation,
        code: errorCode,
        serialized_error: JSON.stringify(serializeError(error)),
      });

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
          message: 'Something went wrong. Please try again.',
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
        message: 'An unexpected error occurred',
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
        isVersionConflict: result.error?.code === 'VERSION_CONFLICT',
      };
    }
  }
}

// Export singleton instance
export const errorService = new ErrorService();

// Utility function for getting error messages (replaces getErrorMessage from errorHandling.ts)
export const getErrorMessage = (error: unknown): string => {
  const result = errorService.parseApolloError(error, { logError: false });
  return result.error?.message || 'An unexpected error occurred';
};

/**
 * Pure extraction of a raw error message from an `unknown` value, with a
 * caller-supplied fallback. Unlike `getErrorMessage`, this does NOT map to a
 * user-friendly message or emit telemetry — use it at display/handler sites
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
    getErrorMessage,
  };
};
