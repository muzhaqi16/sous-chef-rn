jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackError: jest.fn(),
    increment: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('#/utils/errorSerialization', () => ({
  serializeError: jest.fn((e: unknown) => ({ message: String(e) })),
}));

jest.mock('#/utils/errors/queryComplexity', () => ({
  isQueryComplexityError: jest.fn(),
  getQueryComplexityMessage: jest.fn(),
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  isVersionConflictError: jest.fn(),
  getVersionConflictMessage: jest.fn(),
}));

jest.mock('@apollo/client/errors', () => ({
  CombinedGraphQLErrors: { is: jest.fn() },
  ServerError: { is: jest.fn() },
  ServerParseError: { is: jest.fn() },
  CombinedProtocolErrors: { is: jest.fn() },
}));

import {
  errorService,
  localizedErrorMessage,
  useErrorService,
} from '../errorService';
import { GraphQLDomainError } from '#/utils/errors/graphqlErrors';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';
import {
  isQueryComplexityError,
  getQueryComplexityMessage,
} from '#/utils/errors/queryComplexity';
import {
  isVersionConflictError,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import {
  CombinedGraphQLErrors,
  ServerError,
  ServerParseError,
  CombinedProtocolErrors,
} from '@apollo/client/errors';

const mockCombinedGraphQLErrorsIs =
  CombinedGraphQLErrors.is as unknown as jest.Mock;
const mockServerErrorIs = ServerError.is as unknown as jest.Mock;
const mockServerParseErrorIs = ServerParseError.is as unknown as jest.Mock;
const mockCombinedProtocolErrorsIs =
  CombinedProtocolErrors.is as unknown as jest.Mock;

describe('errorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getUserFriendlyMessage
  // -----------------------------------------------------------------------
  describe('getUserFriendlyMessage', () => {
    it('returns mapped message for a known error code', () => {
      expect(errorService.getUserFriendlyMessage('AUTH_TOKEN_EXPIRED')).toBe(
        'Your session has expired. Please sign in again',
      );
    });

    it('returns fallback message when error code is unknown', () => {
      expect(
        errorService.getUserFriendlyMessage('UNKNOWN_XYZ', 'Custom fallback'),
      ).toBe('Custom fallback');
    });

    it('returns default message when error code is unknown and no fallback', () => {
      expect(errorService.getUserFriendlyMessage('UNKNOWN_XYZ')).toBe(
        'An unexpected error occurred',
      );
    });

    // Both account states are mapped, and to different copy. A suspension is a
    // moderation decision and a lockout is a window that expires, so telling a
    // suspended user to wait it out sends them nowhere. Without a mapping the
    // suspended case fell through to the raw server message.
    it('distinguishes a suspended account from a temporary lockout', () => {
      expect(
        errorService.getUserFriendlyMessage(
          'AUTH_ACCOUNT_SUSPENDED',
          'raw server text',
        ),
      ).toBe('This account is no longer active. Please contact support.');
      expect(errorService.getUserFriendlyMessage('AUTH_ACCOUNT_LOCKED')).toBe(
        'Your account has been temporarily locked for security',
      );
    });
  });

  // -----------------------------------------------------------------------
  // getErrorCategory
  // -----------------------------------------------------------------------
  describe('getErrorCategory', () => {
    it('returns Authentication for AUTH_ prefix', () => {
      expect(errorService.getErrorCategory('AUTH_TOKEN_EXPIRED')).toBe(
        'Authentication',
      );
    });

    it('returns Authorization for FORBIDDEN', () => {
      expect(errorService.getErrorCategory('FORBIDDEN')).toBe('Authorization');
    });

    it('returns Authentication for UNAUTHENTICATED', () => {
      expect(errorService.getErrorCategory('UNAUTHENTICATED')).toBe(
        'Authentication',
      );
    });

    it('returns Validation for VALIDATION_ prefix', () => {
      expect(errorService.getErrorCategory('VALIDATION_FAILED')).toBe(
        'Validation',
      );
    });

    it('returns Resource for RESOURCE_ prefix', () => {
      expect(errorService.getErrorCategory('RESOURCE_NOT_FOUND')).toBe(
        'Resource',
      );
    });

    it('returns Service for SERVICE_ prefix', () => {
      expect(errorService.getErrorCategory('SERVICE_UNAVAILABLE')).toBe(
        'Service',
      );
    });

    it('returns Unknown for unrecognized prefix', () => {
      expect(errorService.getErrorCategory('FOOBAR_SOMETHING')).toBe('Unknown');
    });
  });

  // -----------------------------------------------------------------------
  // shouldRetry
  // -----------------------------------------------------------------------
  describe('shouldRetry', () => {
    it.each([
      'SERVICE_UNAVAILABLE',
      'SERVICE_TIMEOUT',
      'SERVICE_OVERLOADED',
      'RATE_LIMIT_EXCEEDED',
      'AUTH_TOKEN_EXPIRED',
    ])('returns true for %s', code => {
      expect(errorService.shouldRetry(code)).toBe(true);
    });

    it('returns false for non-retryable error codes', () => {
      expect(errorService.shouldRetry('AUTH_TOKEN_INVALID')).toBe(false);
      expect(errorService.shouldRetry('VALIDATION_FAILED')).toBe(false);
      expect(errorService.shouldRetry('UNKNOWN_ERROR')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // isAuthError
  // -----------------------------------------------------------------------
  describe('isAuthError', () => {
    it('returns true for AUTH_ prefixed codes', () => {
      expect(errorService.isAuthError('AUTH_TOKEN_EXPIRED')).toBe(true);
      expect(errorService.isAuthError('AUTH_TOKEN_INVALID')).toBe(true);
    });

    it('returns true for UNAUTHENTICATED', () => {
      expect(errorService.isAuthError('UNAUTHENTICATED')).toBe(true);
    });

    // FORBIDDEN is authorization, not authentication. Treating it as an auth
    // error is what let a 403 be handled as a dead session.
    it('returns false for FORBIDDEN', () => {
      expect(errorService.isAuthError('FORBIDDEN')).toBe(false);
    });

    it('returns false for non-auth codes', () => {
      expect(errorService.isAuthError('VALIDATION_FAILED')).toBe(false);
      expect(errorService.isAuthError('NETWORK_ERROR')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // reportError
  // -----------------------------------------------------------------------
  describe('reportError', () => {
    it('reports an Error instance to telemetry', () => {
      const err = new Error('Something broke');
      errorService.reportError(err, { operation: 'TestOp' });

      expect(Telemetry.trackError).toHaveBeenCalledWith(
        'Something broke',
        expect.objectContaining({ component: 'reported', operation: 'TestOp' }),
      );
    });

    it('reports a string error to telemetry', () => {
      errorService.reportError('string error', { operation: 'StringOp' });

      expect(Telemetry.trackError).toHaveBeenCalledWith(
        'string error',
        expect.objectContaining({ operation: 'StringOp' }),
      );
    });

    it('reports an unknown error type with "Unknown error" message', () => {
      errorService.reportError(42);

      expect(Telemetry.trackError).toHaveBeenCalledWith(
        'Unknown error',
        expect.objectContaining({ operation: 'Unknown' }),
      );
    });

    it('logs to logger.error in __DEV__ mode', () => {
      const err = new Error('dev error');
      errorService.reportError(err, { operation: 'DevOp' });

      expect(logger.error).toHaveBeenCalledWith(
        '[ErrorService] DevOp:',
        expect.any(Object),
      );
    });

    it('uses "Unknown" as default operation when no context provided', () => {
      errorService.reportError(new Error('no context'));

      expect(Telemetry.trackError).toHaveBeenCalledWith(
        'no context',
        expect.objectContaining({ operation: 'Unknown' }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // parseApolloError
  // -----------------------------------------------------------------------
  describe('parseApolloError', () => {
    it('detects query complexity errors first', () => {
      const error = new Error('query too complex');
      (isQueryComplexityError as jest.Mock).mockReturnValue(true);
      (getQueryComplexityMessage as jest.Mock).mockReturnValue(
        'Query too complex message',
      );

      const result = errorService.parseApolloError(error, {
        operation: 'FetchItems',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('QUERY_TOO_COMPLEX');
    });

    it('keeps the code of a refusal that arrived as a thrown domain error', () => {
      // `unwrapPayload` turns an error-union member into a throw carrying its
      // `code`. With no branch for it the error fell through to the plain
      // `instanceof Error` arm, `errorCode` stayed 'UNKNOWN_ERROR', and every
      // refusal reaching a caller this way read "An unexpected error occurred".
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);

      const result = errorService.parseApolloError(
        new GraphQLDomainError({
          __typename: 'ConflictError',
          code: 'CONFLICT',
          message: 'Item already exists',
        }),
      );

      expect(result.error?.code).toBe('CONFLICT');
      // Localized from the CODE, not the server's sentence.
      expect(result.error?.message).not.toBe('Item already exists');
      expect(result.error?.message).not.toBe('An unexpected error occurred');
    });

    it('detects version conflict errors', () => {
      const error = new Error('conflict');
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(true);
      (getVersionConflictMessage as jest.Mock).mockReturnValue(
        'Version conflict occurred',
      );

      const result = errorService.parseApolloError(error);

      expect(result.error?.code).toBe('VERSION_CONFLICT');
    });

    it('handles CombinedGraphQLErrors with extensions code', () => {
      const error = {
        errors: [
          {
            message: 'Not authorized',
            extensions: { code: 'FORBIDDEN' },
          },
        ],
      };
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(true);

      const result = errorService.parseApolloError(error);

      expect(result.error?.code).toBe('FORBIDDEN');
      // Authorization, not authentication — this must not be reported as an
      // auth error or callers will treat a permission denial as a dead session.
      expect(result.error?.isAuthError).toBe(false);
    });

    it('handles CombinedGraphQLErrors with VALIDATION_FAILED and validationErrors', () => {
      const error = {
        errors: [
          {
            message: 'Validation failed',
            extensions: {
              code: 'VALIDATION_FAILED',
              validationErrors: { name: 'Name is required' },
            },
          },
        ],
      };
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(true);

      const result = errorService.parseApolloError(error);

      expect(result.error?.code).toBe('VALIDATION_FAILED');
      expect(result.error?.validationErrors).toEqual({
        name: 'Name is required',
      });
    });

    it('defaults to GRAPHQL_ERROR when no extensions code', () => {
      const error = {
        errors: [{ message: 'Something went wrong', extensions: {} }],
      };
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(true);

      const result = errorService.parseApolloError(error);

      expect(result.error?.code).toBe('GRAPHQL_ERROR');
    });

    it.each([
      [401, 'AUTH_TOKEN_INVALID'],
      [403, 'FORBIDDEN'],
      [404, 'RESOURCE_NOT_FOUND'],
      [429, 'RATE_LIMIT_EXCEEDED'],
      [500, 'SERVICE_UNAVAILABLE'],
      [503, 'SERVICE_UNAVAILABLE'],
      [418, 'NETWORK_ERROR'],
    ])(
      'handles ServerError with status %i as %s',
      (statusCode, expectedCode) => {
        const error = { statusCode, message: `Error ${statusCode}` };
        (isQueryComplexityError as jest.Mock).mockReturnValue(false);
        (isVersionConflictError as jest.Mock).mockReturnValue(false);
        mockCombinedGraphQLErrorsIs.mockReturnValue(false);
        mockServerErrorIs.mockReturnValue(true);

        const result = errorService.parseApolloError(error);

        expect(result.error?.code).toBe(expectedCode);
      },
    );

    it('uses fallback message for ServerError when message is empty', () => {
      const error = { statusCode: 502, message: '' };
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(true);

      const result = errorService.parseApolloError(error);

      expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('handles ServerParseError as SERVICE_UNAVAILABLE', () => {
      const error = new Error('parse error');
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(true);

      const result = errorService.parseApolloError(error);

      expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
      expect(result.error?.message).toBe(
        "We're experiencing issues. Please try again shortly.",
      );
    });

    it('handles CombinedProtocolErrors as NETWORK_ERROR', () => {
      const error = { message: 'protocol error' };
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(true);

      const result = errorService.parseApolloError(error);

      expect(result.error?.code).toBe('NETWORK_ERROR');
    });

    it('handles plain Error instances', () => {
      const error = new Error('Something unexpected');
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      const result = errorService.parseApolloError(error);

      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.message).toBe('Something unexpected');
    });

    it('handles string errors', () => {
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      const result = errorService.parseApolloError('a string error');

      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.message).toBe('a string error');
    });

    it('respects customMessage in config', () => {
      const error = new Error('original');
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      const result = errorService.parseApolloError(error, {
        customMessage: 'Custom user message',
      });

      expect(result.error?.message).toBe('Custom user message');
    });

    it('suppresses logger.error when logError is false', () => {
      const error = new Error('silent');
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      errorService.parseApolloError(error, { logError: false });

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('calls logger.error by default', () => {
      const error = new Error('loud');
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      errorService.parseApolloError(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Error in Unknown:',
        expect.objectContaining({ code: 'UNKNOWN_ERROR' }),
      );
    });

    it('reports to Telemetry.trackError and Telemetry.increment', () => {
      const error = new Error('telemetry test');
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      errorService.parseApolloError(error, { operation: 'TelemetryOp' });

      expect(Telemetry.trackError).toHaveBeenCalledWith(
        'telemetry test',
        expect.objectContaining({
          component: 'Unknown',
          code: 'UNKNOWN_ERROR',
          operation: 'TelemetryOp',
        }),
      );
    });

    it('reports expected user errors to Telemetry.warn, not trackError', () => {
      const error = {
        errors: [
          {
            message: 'User already exists with this email',
            extensions: { code: 'EMAIL_ALREADY_EXISTS' },
          },
        ],
      };
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(true);

      errorService.parseApolloError(error, { operation: 'Register' });

      expect(Telemetry.warn).toHaveBeenCalledWith(
        'Validation: EMAIL_ALREADY_EXISTS in Register',
        expect.objectContaining({
          component: 'Email',
          code: 'EMAIL_ALREADY_EXISTS',
          operation: 'Register',
        }),
      );
      expect(Telemetry.trackError).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Validation error in Register:',
        expect.objectContaining({ code: 'EMAIL_ALREADY_EXISTS' }),
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('returns ERROR_HANDLER_FAILED when internal parsing throws', () => {
      // Force an internal throw by making isQueryComplexityError throw
      (isQueryComplexityError as jest.Mock).mockImplementation(() => {
        throw new Error('Internal failure');
      });

      const result = errorService.parseApolloError(new Error('anything'));

      expect(result.error?.code).toBe('ERROR_HANDLER_FAILED');
      expect(result.error?.message).toBe(
        'Something went wrong. Please try again.',
      );
      expect(result.error?.shouldRetry).toBe(false);
      expect(result.error?.isAuthError).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // handleApolloError
  // -----------------------------------------------------------------------
  describe('handleApolloError', () => {
    it('returns a flat ApolloErrorResult', () => {
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      const result = errorService.handleApolloError(new Error('flat error'), {
        operation: 'FlatOp',
      });

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('flat error');
      expect(result.category).toBe('Unknown');
      expect(result.shouldRetry).toBe(false);
      expect(result.isAuthError).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // handleMutation
  // -----------------------------------------------------------------------
  describe('handleMutation', () => {
    it('returns success result when mutation succeeds', async () => {
      const result = await errorService.handleMutation(
        async () => ({ id: '1', name: 'Test' }),
        { operation: 'CreateItem' },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Test' });
      expect(result.error).toBeUndefined();
    });

    it('returns error result when mutation throws', async () => {
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      const result = await errorService.handleMutation(
        async () => {
          throw new Error('Mutation failed');
        },
        { operation: 'UpdateItem' },
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
      expect(result.error?.message).toBe('Mutation failed');
    });
  });

  // -----------------------------------------------------------------------
  // handleMutationWithVersionConflict
  // -----------------------------------------------------------------------
  describe('handleMutationWithVersionConflict', () => {
    it('returns success result when mutation succeeds', async () => {
      const result = await errorService.handleMutationWithVersionConflict(
        async () => ({ id: '1' }),
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1' });
      expect(result.isVersionConflict).toBeUndefined();
    });

    it('sets isVersionConflict to true for version conflict errors', async () => {
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(true);
      (getVersionConflictMessage as jest.Mock).mockReturnValue(
        'Version conflict',
      );

      const result = await errorService.handleMutationWithVersionConflict(
        async () => {
          throw new Error('conflict');
        },
      );

      expect(result.success).toBe(false);
      expect(result.isVersionConflict).toBe(true);
      expect(result.error?.code).toBe('VERSION_CONFLICT');
    });

    it('sets isVersionConflict to false for non-conflict errors', async () => {
      (isQueryComplexityError as jest.Mock).mockReturnValue(false);
      (isVersionConflictError as jest.Mock).mockReturnValue(false);
      mockCombinedGraphQLErrorsIs.mockReturnValue(false);
      mockServerErrorIs.mockReturnValue(false);
      mockServerParseErrorIs.mockReturnValue(false);
      mockCombinedProtocolErrorsIs.mockReturnValue(false);

      const result = await errorService.handleMutationWithVersionConflict(
        async () => {
          throw new Error('other error');
        },
      );

      expect(result.success).toBe(false);
      expect(result.isVersionConflict).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // useErrorService
  // -----------------------------------------------------------------------
  describe('useErrorService', () => {
    it('returns all expected methods', () => {
      const service = useErrorService();

      expect(typeof service.handleApolloError).toBe('function');
      expect(typeof service.parseApolloError).toBe('function');
      expect(typeof service.handleMutation).toBe('function');
      expect(typeof service.handleMutationWithVersionConflict).toBe('function');
      expect(typeof service.getUserFriendlyMessage).toBe('function');
      expect(typeof service.getErrorCategory).toBe('function');
      expect(typeof service.shouldRetry).toBe('function');
      expect(typeof service.isAuthError).toBe('function');
      expect(typeof service.reportError).toBe('function');
    });

    it('bound methods work correctly', () => {
      const service = useErrorService();

      expect(service.getUserFriendlyMessage('AUTH_TOKEN_EXPIRED')).toBe(
        'Your session has expired. Please sign in again',
      );
      expect(service.getErrorCategory('VALIDATION_FAILED')).toBe('Validation');
      expect(service.shouldRetry('SERVICE_TIMEOUT')).toBe(true);
      expect(service.isAuthError('AUTH_TOKEN_INVALID')).toBe(true);
    });
  });
});

describe('localizedErrorMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isQueryComplexityError as jest.Mock).mockReturnValue(false);
    (isVersionConflictError as jest.Mock).mockReturnValue(false);
    mockCombinedGraphQLErrorsIs.mockReturnValue(false);
  });

  it("never returns the server's own message", () => {
    mockCombinedGraphQLErrorsIs.mockReturnValue(true);
    const serverText = 'An unexpected database error occurred';
    const message = localizedErrorMessage({
      errors: [
        {
          message: serverText,
          extensions: { code: 'RESOURCE_NOT_FOUND' },
        },
      ],
    });

    // The server's text is unlocalizable English by construction — it belongs
    // in the log (via `errorMessageOr`), never in front of a user.
    expect(message).not.toBe(serverText);
  });

  it('falls back to localized copy for an unmapped code, not the raw text', () => {
    mockCombinedGraphQLErrorsIs.mockReturnValue(true);
    const serverText = 'Some brand new server condition';
    const message = localizedErrorMessage({
      errors: [
        {
          message: serverText,
          extensions: { code: 'A_CODE_THE_CLIENT_HAS_NEVER_SEEN' },
        },
      ],
    });

    // A vaguer sentence in the right language beats a precise one in the wrong
    // language — and the precise one is in the report either way.
    expect(message).not.toBe(serverText);
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('returns localized copy when the error carries no code at all', () => {
    const message = localizedErrorMessage(new Error('boom'));
    expect(message).not.toBe('boom');
    expect(message.length).toBeGreaterThan(0);
  });
});
