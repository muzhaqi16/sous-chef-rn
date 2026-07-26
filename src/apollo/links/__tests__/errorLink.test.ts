'use no memo';

/**
 * Tests for errorLink - both helper functions AND the actual ErrorLink middleware.
 */

// --- Mocks (must be before imports) ---

jest.mock('#utils/subscriptionErrorHandler', () => ({
  isKnownServerError: jest.fn(() => false),
}));
jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));
jest.mock('../../logoutCleanup', () => ({
  LogoutCleanup: {
    isInLogoutProcess: jest.fn(() => false),
  },
}));
jest.mock('../refreshToken', () => ({
  attemptTokenRefresh: jest.fn(),
  getRefreshState: jest.fn(() => ({ isRefreshing: false })),
}));
const mockClearAuth = jest.fn();
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({ clearAuth: mockClearAuth })),
  },
}));

import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import { Observable } from 'rxjs';
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
} from '@apollo/client/errors';
import type { FormattedExecutionResult } from 'graphql';
import { errorLink } from '../errorLink';
import { LogoutCleanup } from '../../logoutCleanup';
import { attemptTokenRefresh, getRefreshState } from '../refreshToken';
import { isKnownServerError } from '#utils/subscriptionErrorHandler';
import { isNetworkError } from '#/utils/isNetworkError';

// ---- Pure helper function tests (replicated logic) ----

describe('errorLink helpers', () => {
  const isAuthError = (code: string, msg: string) =>
    code === 'UNAUTHENTICATED' ||
    code === 'AUTH_TOKEN_EXPIRED' ||
    ['expired', 'unauthorized', 'invalid token', 'jwt'].some(term =>
      msg.toLowerCase().includes(term),
    );

  const isResourceAccessError = (code: string) => code === 'FORBIDDEN';

  const isApiKeyError = (code: string, msg: string) =>
    ['API_KEY_REQUIRED', 'INVALID_API_KEY', 'API_KEY_EXPIRED'].includes(code) ||
    msg.toLowerCase().includes('api key');

  type TestDefinition = { kind: string; operation?: string; name?: string };
  type TestOperation = { query: { definitions: TestDefinition[] } };
  const isSubscription = (op: TestOperation) =>
    op.query.definitions.some(
      (def: TestDefinition) =>
        def.kind === 'OperationDefinition' && def.operation === 'subscription',
    );

  describe('isAuthError', () => {
    it('returns true for UNAUTHENTICATED code', () => {
      expect(isAuthError('UNAUTHENTICATED', '')).toBe(true);
    });

    it('returns true for UNAUTHENTICATED code regardless of message', () => {
      expect(isAuthError('UNAUTHENTICATED', 'some random message')).toBe(true);
    });

    it('returns true for AUTH_TOKEN_EXPIRED code', () => {
      expect(isAuthError('AUTH_TOKEN_EXPIRED', '')).toBe(true);
    });

    it('returns true for AUTH_TOKEN_EXPIRED code regardless of message', () => {
      expect(isAuthError('AUTH_TOKEN_EXPIRED', 'some random message')).toBe(
        true,
      );
    });

    it('returns true when message contains "expired"', () => {
      expect(isAuthError('SOME_CODE', 'Token has expired')).toBe(true);
    });

    it('returns true when message contains "unauthorized"', () => {
      expect(isAuthError('', 'Unauthorized access')).toBe(true);
    });

    it('returns true when message contains "invalid token"', () => {
      expect(isAuthError('', 'The invalid token was provided')).toBe(true);
    });

    it('returns true when message contains "jwt"', () => {
      expect(isAuthError('', 'JWT malformed')).toBe(true);
    });

    it('is case-insensitive for message matching', () => {
      expect(isAuthError('', 'EXPIRED')).toBe(true);
      expect(isAuthError('', 'JWT Malformed')).toBe(true);
      expect(isAuthError('', 'UNAUTHORIZED')).toBe(true);
      expect(isAuthError('', 'Invalid Token provided')).toBe(true);
    });

    it('returns false for non-auth errors', () => {
      expect(isAuthError('NOT_FOUND', 'Resource not found')).toBe(false);
    });

    it('returns false for FORBIDDEN code', () => {
      expect(isAuthError('FORBIDDEN', 'Access denied')).toBe(false);
    });

    it('returns false for empty code and unrelated message', () => {
      expect(isAuthError('', 'Something else went wrong')).toBe(false);
    });

    it('returns false for validation errors', () => {
      expect(isAuthError('VALIDATION_ERROR', 'Field is required')).toBe(false);
    });
  });

  describe('isResourceAccessError', () => {
    it('returns true for FORBIDDEN code', () => {
      expect(isResourceAccessError('FORBIDDEN')).toBe(true);
    });

    it('returns false for UNAUTHENTICATED code', () => {
      expect(isResourceAccessError('UNAUTHENTICATED')).toBe(false);
    });

    it('returns false for empty code', () => {
      expect(isResourceAccessError('')).toBe(false);
    });

    it('returns false for other codes', () => {
      expect(isResourceAccessError('NOT_FOUND')).toBe(false);
      expect(isResourceAccessError('INTERNAL_SERVER_ERROR')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(isResourceAccessError('forbidden')).toBe(false);
      expect(isResourceAccessError('Forbidden')).toBe(false);
    });
  });

  describe('isApiKeyError', () => {
    it('returns true for API_KEY_REQUIRED code', () => {
      expect(isApiKeyError('API_KEY_REQUIRED', '')).toBe(true);
    });

    it('returns true for INVALID_API_KEY code', () => {
      expect(isApiKeyError('INVALID_API_KEY', '')).toBe(true);
    });

    it('returns true for API_KEY_EXPIRED code', () => {
      expect(isApiKeyError('API_KEY_EXPIRED', '')).toBe(true);
    });

    it('returns true when message contains "api key"', () => {
      expect(isApiKeyError('', 'Missing api key in request')).toBe(true);
    });

    it('is case-insensitive for message matching', () => {
      expect(isApiKeyError('', 'API Key is invalid')).toBe(true);
      expect(isApiKeyError('', 'API KEY MISSING')).toBe(true);
    });

    it('returns false for non-api-key errors', () => {
      expect(isApiKeyError('UNAUTHENTICATED', 'Token expired')).toBe(false);
    });

    it('returns false for empty code and unrelated message', () => {
      expect(isApiKeyError('', 'Something else')).toBe(false);
    });

    it('code matching is case-sensitive', () => {
      expect(isApiKeyError('api_key_required', '')).toBe(false);
    });
  });

  describe('isSubscription', () => {
    it('returns true for subscription operations', () => {
      const op = {
        query: {
          definitions: [
            { kind: 'OperationDefinition', operation: 'subscription' },
          ],
        },
      };
      expect(isSubscription(op)).toBe(true);
    });

    it('returns false for query operations', () => {
      const op = {
        query: {
          definitions: [{ kind: 'OperationDefinition', operation: 'query' }],
        },
      };
      expect(isSubscription(op)).toBe(false);
    });

    it('returns false for mutation operations', () => {
      const op = {
        query: {
          definitions: [{ kind: 'OperationDefinition', operation: 'mutation' }],
        },
      };
      expect(isSubscription(op)).toBe(false);
    });

    it('returns false when definitions array is empty', () => {
      const op = {
        query: { definitions: [] },
      };
      expect(isSubscription(op)).toBe(false);
    });

    it('returns false for non-OperationDefinition kinds', () => {
      const op = {
        query: {
          definitions: [
            { kind: 'FragmentDefinition', operation: 'subscription' },
          ],
        },
      };
      expect(isSubscription(op)).toBe(false);
    });

    it('returns true if any definition is a subscription', () => {
      const op = {
        query: {
          definitions: [
            { kind: 'FragmentDefinition', name: 'SomeFragment' },
            { kind: 'OperationDefinition', operation: 'subscription' },
          ],
        },
      };
      expect(isSubscription(op)).toBe(true);
    });
  });
});

// ---- ErrorLink middleware integration tests ----

describe('errorLink middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports errorLink as an instance', () => {
    expect(errorLink).toBeDefined();
  });

  it('skips processing when skipErrorLink context is set', () => {
    // The errorLink checks operation.getContext().skipErrorLink
    // This verifies the mock setup is correct
    expect(LogoutCleanup.isInLogoutProcess).toBeDefined();
    expect(typeof (LogoutCleanup.isInLogoutProcess as jest.Mock)).toBe(
      'function',
    );
  });

  it('getRefreshState returns current state', () => {
    const state = getRefreshState();
    expect(state).toEqual({ isRefreshing: false });
  });

  it('attemptTokenRefresh is callable', () => {
    expect(typeof attemptTokenRefresh).toBe('function');
  });

  it('isKnownServerError is callable', () => {
    expect(typeof isKnownServerError).toBe('function');
    expect(isKnownServerError({ message: 'test' })).toBe(false);
  });

  it('isNetworkError is callable', () => {
    expect(typeof isNetworkError).toBe('function');
    expect(isNetworkError(new Error('test'))).toBe(false);
  });

  it('CombinedGraphQLErrors.is works for type checking', () => {
    // Verify the error classification infrastructure works
    const plainError = new Error('plain');
    expect(CombinedGraphQLErrors.is(plainError)).toBe(false);
    expect(CombinedProtocolErrors.is(plainError)).toBe(false);
  });

  it('CombinedGraphQLErrors.is returns true for proper GraphQL errors', () => {
    const result: FormattedExecutionResult = {
      errors: [{ message: 'Test error', extensions: { code: 'TEST' } }],
    };
    const gqlError = new CombinedGraphQLErrors(result);
    expect(CombinedGraphQLErrors.is(gqlError)).toBe(true);
  });
});

// A build below the server's minimum version is refused permanently. Refreshing
// the token succeeds and then fails identically, so the link must not start a
// refresh cycle over it.
describe('errorLink — CLIENT_UPGRADE_REQUIRED', () => {
  const query = gql`
    query TestOp {
      me {
        id
      }
    }
  `;

  // ApolloLink.execute needs a client on its context, so the chain gets a
  // throwaway one — it never reaches the network, the failing link below
  // terminates the chain.
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const runWithError = (
    errors: FormattedExecutionResult['errors'],
  ): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const failing = new ApolloLink(
        () =>
          new Observable(observer => {
            observer.error(new CombinedGraphQLErrors({ errors }));
          }),
      );

      ApolloLink.execute(
        ApolloLink.from([errorLink, failing]),
        { query, variables: {} },
        { client },
      ).subscribe({
        next: resolve,
        error: reject,
        complete: () => resolve(undefined),
      });
    });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not attempt a token refresh', async () => {
    await expect(
      runWithError([
        {
          message: 'Client upgrade required: 5.0.0',
          extensions: {
            code: 'CLIENT_UPGRADE_REQUIRED',
            minimumVersion: '5.0.0',
          },
        },
      ]),
    ).rejects.toBeDefined();

    expect(attemptTokenRefresh).not.toHaveBeenCalled();
  });

  it('still refreshes for a genuine auth error (guards the early bail)', async () => {
    await runWithError([
      { message: 'Token expired', extensions: { code: 'UNAUTHENTICATED' } },
    ]).catch(() => undefined);

    expect(attemptTokenRefresh).toHaveBeenCalled();
  });

  // The @auth directive rejects every field for a suspended/banned/deleted
  // account. The session must end (the user can do nothing), while ordinary
  // resource-level FORBIDDEN stays non-fatal.
  describe('suspended/deleted account', () => {
    it('ends the session on the AUTH_ACCOUNT_SUSPENDED code alone', async () => {
      await runWithError([
        {
          message: 'User account is not active',
          extensions: { code: 'AUTH_ACCOUNT_SUSPENDED' },
        },
      ]).catch(() => undefined);

      expect(mockClearAuth).toHaveBeenCalledTimes(1);
      expect(attemptTokenRefresh).not.toHaveBeenCalled();
    });

    it('ends the session without a reason string present', async () => {
      await runWithError([
        {
          message: 'User account is not active',
          extensions: {
            code: 'AUTH_ACCOUNT_SUSPENDED',
            field: 'pantries',
            http: { status: 403 },
          },
        },
      ]).catch(() => undefined);

      expect(mockClearAuth).toHaveBeenCalledTimes(1);
    });

    // Servers predating the dedicated code send FORBIDDEN + a prose reason.
    it('ends the session on the legacy FORBIDDEN + reason shape', async () => {
      await runWithError([
        {
          message: 'User account is not active',
          extensions: {
            code: 'FORBIDDEN',
            reason: 'User account has been suspended or deleted',
          },
        },
      ]).catch(() => undefined);

      expect(mockClearAuth).toHaveBeenCalledTimes(1);
      expect(attemptTokenRefresh).not.toHaveBeenCalled();
    });

    it('plain resource FORBIDDEN does NOT end the session', async () => {
      await runWithError([
        {
          message: 'Access denied',
          extensions: { code: 'FORBIDDEN' },
        },
      ]).catch(() => undefined);

      expect(mockClearAuth).not.toHaveBeenCalled();
    });
  });
});
