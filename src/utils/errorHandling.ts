import { logger } from './environment';
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
  ServerParseError,
} from '@apollo/client/errors';

export interface ApiErrorResponse {
  success: boolean;
  code?: string;
  message?: string;
  details?: any;
  requestId?: string;
  timestamp?: string;
  validationErrors?: Record<string, string>;
  retryAfter?: number;
}

export interface ErrorHandlerConfig {
  operation?: string;
  showToast?: boolean;
  logError?: boolean;
}

export class ErrorHandler {
  private static readonly ERROR_MESSAGES: Record<string, string> = {
    // Authentication Errors
    'AUTH_TOKEN_MISSING': 'Please sign in to continue',
    'AUTH_TOKEN_INVALID': 'Your session is invalid. Please sign in again',
    'AUTH_TOKEN_EXPIRED': 'Your session has expired. Please sign in again',
    'AUTH_REFRESH_TOKEN_MISSING': 'Session expired. Please sign in again',
    'AUTH_REFRESH_TOKEN_INVALID': 'Session expired. Please sign in again',
    'AUTH_CREDENTIALS_INVALID': 'Invalid email or password',
    'AUTH_ACCOUNT_LOCKED': 'Your account has been temporarily locked for security',
    'AUTH_EMAIL_NOT_VERIFIED': 'Please verify your email before continuing',

    // Authorization Errors
    'AUTHZ_FORBIDDEN': 'You don\'t have permission to perform this action',
    'AUTHZ_INSUFFICIENT_PERMISSIONS': 'You don\'t have sufficient permissions',
    'AUTHZ_RESOURCE_ACCESS_DENIED': 'Access denied to this resource',
    'AUTHZ_ADMIN_REQUIRED': 'Administrator privileges required',
    'AUTHZ_MODERATOR_REQUIRED': 'Moderator privileges required',

    // API Key Errors
    'API_KEY_MISSING': 'API key is missing. Please check your configuration',
    'API_KEY_INVALID': 'Invalid API key. Please check your configuration',
    'API_KEY_EXPIRED': 'API key has expired. Please contact support',
    'API_KEY_REVOKED': 'API key has been revoked. Please contact support',
    'API_KEY_RATE_LIMITED': 'API rate limit exceeded. Please try again later',

    // Validation Errors
    'VALIDATION_FAILED': 'Please check your input and try again',
    'VALIDATION_FIELD_REQUIRED': 'Required field is missing',
    'VALIDATION_FIELD_INVALID': 'Invalid field value',
    'VALIDATION_FORMAT_INVALID': 'Invalid format',
    'VALIDATION_LENGTH_INVALID': 'Input length is invalid',
    'VALIDATION_RANGE_INVALID': 'Value is outside allowed range',
    'VALIDATION_UNIQUE_CONSTRAINT': 'This value already exists',

    // Resource Errors
    'RESOURCE_NOT_FOUND': 'The requested item was not found',
    'RESOURCE_ALREADY_EXISTS': 'This item already exists',
    'RESOURCE_CONFLICT': 'There\'s a conflict with this operation',
    'RESOURCE_GONE': 'This item is no longer available',
    'RESOURCE_LOCKED': 'This item is currently locked and cannot be modified',

    // Business Logic Errors
    'BUSINESS_RULE_VIOLATION': 'This action violates business rules',
    'BUSINESS_STATE_INVALID': 'Invalid state for this operation',
    'BUSINESS_OPERATION_NOT_ALLOWED': 'This operation is not allowed',
    'BUSINESS_QUOTA_EXCEEDED': 'You\'ve exceeded your quota limit',
    'BUSINESS_FEATURE_DISABLED': 'This feature is currently disabled',

    // Rate Limiting Errors
    'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later',
    'RATE_LIMIT_IP_BLOCKED': 'Your IP has been rate limited',
    'RATE_LIMIT_USER_BLOCKED': 'Your account has been rate limited',
    'RATE_LIMIT_API_KEY_BLOCKED': 'API key rate limit exceeded',

    // Service Errors
    'SERVICE_UNAVAILABLE': 'Service is temporarily unavailable',
    'SERVICE_TIMEOUT': 'Request timed out. Please try again',
    'SERVICE_MAINTENANCE': 'Service is under maintenance',
    'SERVICE_OVERLOADED': 'Service is overloaded. Please try again later',

    // Application-Specific Errors
    'SHOPPING_LIST_NOT_FOUND': 'Shopping list not found',
    'SHOPPING_LIST_ACCESS_DENIED': 'You don\'t have access to this shopping list',
    'SHOPPING_ITEM_NOT_FOUND': 'Shopping item not found',
    'SHOPPING_ITEM_ALREADY_EXISTS': 'This item is already in your shopping list',

    'HOME_NOT_FOUND': 'Home not found',
    'HOME_ACCESS_DENIED': 'You don\'t have access to this home',
    'HOME_INVITE_INVALID': 'Invalid home invitation',
    'HOME_INVITE_EXPIRED': 'Home invitation has expired',
    'HOME_MEMBER_ALREADY_EXISTS': 'User is already a member of this home',
  };

  private static readonly RETRYABLE_ERRORS = [
    'SERVICE_UNAVAILABLE',
    'SERVICE_TIMEOUT',
    'SERVICE_OVERLOADED',
    'RATE_LIMIT_EXCEEDED',
    'AUTH_TOKEN_EXPIRED',
  ];

  private static readonly ERROR_CATEGORIES: Record<string, string> = {
    'AUTH_': 'Authentication',
    'AUTHZ_': 'Authorization',
    'API_': 'API Key',
    'VALIDATION_': 'Validation',
    'RESOURCE_': 'Resource',
    'BUSINESS_': 'Business Logic',
    'RATE_': 'Rate Limiting',
    'SERVICE_': 'Service',
    'SHOPPING_': 'Shopping',
    'HOME_': 'Home Management',
  };

  static getErrorCategory(errorCode: string): string {
    for (const [prefix, category] of Object.entries(this.ERROR_CATEGORIES)) {
      if (errorCode.startsWith(prefix)) {
        return category;
      }
    }
    return 'Unknown';
  }

  static shouldRetry(errorCode: string): boolean {
    return this.RETRYABLE_ERRORS.includes(errorCode);
  }

  static isAuthError(errorCode: string): boolean {
    return errorCode.startsWith('AUTH_') || errorCode.startsWith('AUTHZ_');
  }

  static getUserFriendlyMessage(errorCode: string, fallbackMessage?: string): string {
    return this.ERROR_MESSAGES[errorCode] || fallbackMessage || 'An unexpected error occurred';
  }

  static handleApolloError(
    error: unknown,
    config: ErrorHandlerConfig = {}
  ): {
    code: string;
    message: string;
    category: string;
    shouldRetry: boolean;
    isAuthError: boolean;
    validationErrors?: Record<string, string>;
  } {
    const { operation = 'Unknown', logError = true } = config;

    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'An unexpected error occurred';
    let validationErrors: Record<string, string> | undefined;

    try {
      // Use Apollo's proper error type checking
      if (CombinedGraphQLErrors.is(error)) {
        // Handle GraphQL errors
        const graphQLError = error.errors[0];
        if (graphQLError) {
          errorCode = graphQLError.extensions?.code as string || 'GRAPHQL_ERROR';
          errorMessage = graphQLError.message;

          // Fix error code mapping - server sends AUTH_TOKEN_MISSING for invalid credentials
          if (errorCode === 'AUTH_TOKEN_MISSING' && errorMessage.toLowerCase().includes('invalid credentials')) {
            errorCode = 'AUTH_CREDENTIALS_INVALID';
          }

          // Handle validation errors
          if (errorCode === 'VALIDATION_FAILED' && graphQLError.extensions?.validationErrors) {
            validationErrors = graphQLError.extensions.validationErrors as Record<string, string>;
          }
        }
      } else if (ServerError.is(error)) {
        // Handle server HTTP errors
        const statusCode = error.statusCode;
        if (statusCode === 401) {
          errorCode = 'AUTH_TOKEN_INVALID';
        } else if (statusCode === 403) {
          errorCode = 'AUTHZ_FORBIDDEN';
        } else if (statusCode === 404) {
          errorCode = 'RESOURCE_NOT_FOUND';
        } else if (statusCode === 429) {
          errorCode = 'RATE_LIMIT_EXCEEDED';
        } else if (statusCode >= 500) {
          errorCode = 'SERVICE_UNAVAILABLE';
        } else {
          errorCode = 'NETWORK_ERROR';
        }
        errorMessage = error.message || `Network error (${statusCode})`;
      } else if (ServerParseError.is(error)) {
        errorCode = 'SERVICE_UNAVAILABLE';
        errorMessage = 'Server response could not be parsed';
      } else if (CombinedProtocolErrors.is(error)) {
        errorCode = 'NETWORK_ERROR';
        errorMessage = error.message || 'Network communication error';
      } else {
        // Fallback for other error types
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
      }

      const userFriendlyMessage = ErrorHandler.getUserFriendlyMessage(errorCode, errorMessage);
      const category = ErrorHandler.getErrorCategory(errorCode);
      const shouldRetry = ErrorHandler.shouldRetry(errorCode);
      const isAuthError = ErrorHandler.isAuthError(errorCode);

      if (logError) {
        logger.error(`Apollo error in ${operation}:`, {
          code: errorCode,
          message: errorMessage,
          category,
          originalError: error,
        });
      }

      return {
        code: errorCode,
        message: userFriendlyMessage,
        category,
        shouldRetry,
        isAuthError,
        validationErrors,
      };
    } catch (handlerError) {
      // Fallback error handling if anything goes wrong in processing
      return {
        code: 'ERROR_HANDLER_FAILED',
        message: 'Something went wrong. Please try again.',
        category: 'Unknown',
        shouldRetry: false,
        isAuthError: true,
        validationErrors: undefined,
      };
    }
  }

  static handleGenericError(
    error: any,
    config: ErrorHandlerConfig = {}
  ): {
    code: string;
    message: string;
    category: string;
  } {
    const { operation = 'Unknown', logError = true } = config;

    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'An unexpected error occurred';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Try to extract error code from message or other properties
      if (error.message.includes('Network')) {
        errorCode = 'NETWORK_ERROR';
      } else if (error.message.includes('timeout')) {
        errorCode = 'SERVICE_TIMEOUT';
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    const category = this.getErrorCategory(errorCode);

    if (logError) {
      logger.error(`Error in ${operation}:`, {
        code: errorCode,
        message: errorMessage,
        category,
        originalError: error,
      });
    }

    return {
      code: errorCode,
      message: errorMessage,
      category,
    };
  }
}

// Hook for handling errors in components
export const useErrorHandler = () => {
  return {
    handleApolloError: ErrorHandler.handleApolloError,
    handleGenericError: ErrorHandler.handleGenericError,
    getUserFriendlyMessage: ErrorHandler.getUserFriendlyMessage,
    getErrorCategory: ErrorHandler.getErrorCategory,
    shouldRetry: ErrorHandler.shouldRetry,
    isAuthError: ErrorHandler.isAuthError,
  };
};