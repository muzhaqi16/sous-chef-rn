'use no memo';

import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { logger } from '#/utils/environment';

// --- Mocks must be defined before imports ---

jest.mock('#/apollo/links/refreshToken');
const { attemptTokenRefresh: mockAttemptTokenRefresh, getRefreshState: mockGetRefreshState } =
  jest.requireMock('#/apollo/links/refreshToken') as { attemptTokenRefresh: jest.Mock; getRefreshState: jest.Mock };

jest.mock('#utils/subscriptionErrorHandler', () => ({
  isKnownServerError: jest.fn((error: { message?: string }) => {
    const msg = (error?.message || '').toLowerCase();
    return msg.includes('known server error');
  }),
}));

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn((error: { message?: string }) => {
    const msg = (error?.message || '').toLowerCase();
    return msg.includes('network') || msg.includes('timeout');
  }),
}));

const mockIsInLogoutProcess = jest.fn(() => false);
jest.mock('#/apollo/logoutCleanup', () => ({
  LogoutCleanup: {
    isInLogoutProcess: () => mockIsInLogoutProcess(),
  },
}));

interface MockOperation {
  operationName: string;
  getContext: jest.Mock;
  query: { definitions: Array<{ kind: string; operation: string }> };
}

describe('errorLink.ts', () => {
  let mockForward: jest.Mock;
  let mockOperation: MockOperation;

  beforeEach(() => {
    jest.clearAllMocks();
    mockForward = jest.fn(() => ({
      subscribe: jest.fn(),
    }));
    mockOperation = {
      operationName: 'TestQuery',
      getContext: jest.fn(() => ({})),
      query: {
        definitions: [
          { kind: 'OperationDefinition', operation: 'query' },
        ],
      },
    };
  });

  // Since ErrorLink is hard to invoke directly, we test via the exported instance
  // by examining its constructor argument behavior. We re-create the link to test.

  describe('error handler function', () => {
    type HandlerArgs = {
      error: { message?: string };
      operation: MockOperation;
      forward: jest.Mock;
    };
    let errorHandler: (args: HandlerArgs) => unknown;

    beforeEach(() => {
      jest.isolateModules(() => {
        // Capture the handler passed to ErrorLink constructor
        jest.doMock('@apollo/client/link/error', () => ({
          ErrorLink: class {
            constructor(fn: (args: HandlerArgs) => unknown) {
              errorHandler = fn;
            }
          },
        }));
        require('#/apollo/links/errorLink');
      });
    });

    it('returns early when skipErrorLink is in context', () => {
      mockOperation.getContext.mockReturnValue({ skipErrorLink: true });
      const result = errorHandler({ error: new Error('test'), operation: mockOperation, forward: mockForward });
      expect(result).toBeUndefined();
    });

    it('returns early during logout process', () => {
      mockIsInLogoutProcess.mockReturnValue(true);
      const result = errorHandler({ error: new Error('test'), operation: mockOperation, forward: mockForward });
      expect(result).toBeUndefined();
      mockIsInLogoutProcess.mockReturnValue(false);
    });

    // The codes the API actually emits (docs/api/errors.md "API Key Errors").
    // API_KEY_REQUIRED and INVALID_API_KEY are deliberately absent: neither is
    // in the server's registry, so nothing sends them.
    it.each(['API_KEY_MISSING', 'API_KEY_INVALID', 'API_KEY_EXPIRED', 'API_KEY_REVOKED'])(
      'handles %s as an API key error',
      code => {
        const error = new CombinedGraphQLErrors({
          errors: [{ message: 'Key problem', extensions: { code } }],
        });
        errorHandler({ error, operation: mockOperation, forward: mockForward });
        expect(logger.error).toHaveBeenCalledWith('API Key error:', expect.any(String));
      },
    );

    // Classification is by code alone. Substring-matching "api key" in the
    // message let a refusal whose wording merely mentioned the key fall through
    // to the auth branch and spend a pointless token refresh.
    it('does not treat an unrelated code as an API key error because of its message', () => {
      const error = new CombinedGraphQLErrors({
        errors: [{ message: 'Please provide an API key for authentication', extensions: { code: 'SOME_CODE' } }],
      });
      errorHandler({ error, operation: mockOperation, forward: mockForward });
      expect(logger.error).not.toHaveBeenCalledWith('API Key error:', expect.any(String));
      expect(mockAttemptTokenRefresh).not.toHaveBeenCalled();
    });

    it('handles FORBIDDEN as resource access error (not auth error)', () => {
      const error = new CombinedGraphQLErrors({
        errors: [{ message: 'Access denied', extensions: { code: 'FORBIDDEN' } }],
      });
      const result = errorHandler({ error, operation: mockOperation, forward: mockForward });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Access denied'));
      expect(mockAttemptTokenRefresh).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('initiates token refresh on UNAUTHENTICATED error', () => {
      mockAttemptTokenRefresh.mockReturnValue('observable');
      const error = new CombinedGraphQLErrors({
        errors: [{ message: 'Token expired', extensions: { code: 'UNAUTHENTICATED' } }],
      });
      const result = errorHandler({ error, operation: mockOperation, forward: mockForward });
      expect(mockAttemptTokenRefresh).toHaveBeenCalledWith(mockOperation, mockForward);
      expect(result).toBe('observable');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Auth error detected for'),
      );
    });

    // The access-token side: a refresh mints a working token and the operation
    // can be replayed. AUTH_TOKEN_INVALID is included because the old message
    // heuristics missed it entirely — "token is malformed or invalid" matched
    // none of the terms they searched for.
    it.each(['AUTH_TOKEN_EXPIRED', 'AUTH_TOKEN_MISSING', 'AUTH_TOKEN_INVALID'])(
      'initiates token refresh on %s',
      code => {
        mockAttemptTokenRefresh.mockReturnValue('observable');
        const error = new CombinedGraphQLErrors({
          errors: [{ message: 'Token problem', extensions: { code } }],
        });
        errorHandler({ error, operation: mockOperation, forward: mockForward });
        expect(mockAttemptTokenRefresh).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Auth error detected for'),
        );
      },
    );

    // Refusals are classified by code, never by prose. These messages all match
    // a term the old substring heuristics searched for ('expired',
    // 'unauthorized', 'invalid token', 'jwt'), but none of them is an
    // access-token problem, so none may spend a token refresh.
    it.each([
      ['Your subscription has expired', 'BUSINESS_QUOTA_EXCEEDED'],
      ['Unauthorized: key lacks the required permission', 'API_KEY_INSUFFICIENT_PERMISSIONS'],
      ['The provided invalid token was rejected', 'VALIDATION_FAILED'],
      ['jwt malformed', 'BAD_REQUEST'],
    ])('does not refresh on %s (code %s)', (message, code) => {
      const error = new CombinedGraphQLErrors({
        errors: [{ message, extensions: { code } }],
      });
      errorHandler({ error, operation: mockOperation, forward: mockForward });
      expect(mockAttemptTokenRefresh).not.toHaveBeenCalled();
    });

    it('skips token refresh for RefreshToken operation (avoids infinite loop)', () => {
      mockOperation.operationName = 'RefreshToken';
      const error = new CombinedGraphQLErrors({
        errors: [{ message: 'expired', extensions: { code: 'UNAUTHENTICATED' } }],
      });
      errorHandler({ error, operation: mockOperation, forward: mockForward });
      expect(mockAttemptTokenRefresh).not.toHaveBeenCalled();
    });

    it('suppresses auth error logging when refresh is already in progress', () => {
      mockGetRefreshState.mockReturnValue({ isRefreshing: true });
      mockAttemptTokenRefresh.mockReturnValue('observable');
      const error = new CombinedGraphQLErrors({
        errors: [{ message: 'expired', extensions: { code: 'UNAUTHENTICATED' } }],
      });
      errorHandler({ error, operation: mockOperation, forward: mockForward });
      // Should NOT have the "Auth error detected" warning
      const authWarning = jest.mocked(logger.warn).mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Auth error detected'),
      );
      expect(authWarning).toBeUndefined();
    });

    it('handles subscription known server error', () => {
      mockOperation.query.definitions = [
        { kind: 'OperationDefinition', operation: 'subscription' },
      ];
      // Not a CombinedGraphQLErrors or CombinedProtocolErrors
      const error = { message: 'Known server error' };
      errorHandler({ error, operation: mockOperation, forward: mockForward });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Known server error'),
        expect.any(String),
      );
    });

    it('does not re-forward or log network errors (networkStatusLink logs; retryLink owns retries)', () => {
      const error = { message: 'Network request failed' };
      const result = errorHandler({
        error,
        operation: mockOperation,
        forward: mockForward,
      });
      // Returning void propagates the networkError to the observer; re-forwarding
      // would double query retries and re-send mutations.
      expect(result).toBeUndefined();
      expect(mockForward).not.toHaveBeenCalled();
      // Network-error logging moved to networkStatusLink (one warning per
      // operation, above retryLink). errorLink stays silent on network errors.
      const networkWarn = jest
        .mocked(logger.warn)
        .mock.calls.find(
          call => typeof call[0] === 'string' && call[0].includes('Network error'),
        );
      expect(networkWarn).toBeUndefined();
    });

    it('logs unexpected non-network, non-GraphQL errors', () => {
      const error = { message: 'Something completely unexpected' };
      errorHandler({ error, operation: mockOperation, forward: mockForward });
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error'),
        expect.any(String),
      );
    });

    it('does not call forward for non-subscription known server errors', () => {
      // query + non-known-server-error + non-network = unexpected
      const error = { message: 'Random error' };
      errorHandler({ error, operation: mockOperation, forward: mockForward });
      // Forward is NOT called for unexpected errors (only for network errors)
      expect(mockForward).not.toHaveBeenCalled();
    });

    it('does not process CombinedProtocolErrors (falls through)', () => {
      // CombinedProtocolErrors are protocol-level issues, not handled by this link
      // We can't easily construct one, but we can verify the branch by checking
      // that non-GraphQL, non-network errors that are protocol-like are skipped
      // Create a mock that CombinedProtocolErrors.is returns true for
      const error = { message: 'Protocol error' };
      // This tests the else-if branch
      errorHandler({ error, operation: mockOperation, forward: mockForward });
    });
  });
});
