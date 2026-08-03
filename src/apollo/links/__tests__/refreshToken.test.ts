import { jwtDecode, type JwtPayload } from 'jwt-decode';

// Mock jwt-decode
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

// Mock store
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      tokenRefreshFailed: jest.fn(),
      setTokens: jest.fn(),
      setNeedsTokenRefresh: jest.fn(),
    })),
  },
}));

// Environment is auto-mocked via jest.setup.js (logger is jest.fn() no-ops,
// isDevelopment defaults to true) — no per-suite override needed.

// Mock isNetworkError
jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));

// Mock wsLink
jest.mock('../wsLink', () => ({
  reconnectWebSocket: jest.fn(),
  isWebSocketReconnecting: jest.fn(() => false),
  registerSessionAuthRefresh: jest.fn(),
}));

// Mock Apollo client
jest.mock('../../client', () => ({
  client: {
    mutate: jest.fn(),
  },
}));

import type { ApolloLink } from '@apollo/client/link';
import {
  isRefreshTokenValid,
  getRefreshState,
  clearRefreshState,
  attemptTokenRefresh,
  proactiveTokenRefresh,
  registerApolloClient,
} from '../refreshToken';
import { useStore } from '#store';
import { client } from '../../client';
import { isNetworkError } from '#/utils/isNetworkError';
import { reconnectWebSocket, isWebSocketReconnecting } from '../wsLink';

const mockedJwtDecode = jwtDecode as jest.MockedFunction<typeof jwtDecode>;
const mockedClient = client as jest.Mocked<typeof client>;
const mockedUseStore = useStore as jest.Mocked<typeof useStore>;
const mockedIsNetworkError = isNetworkError as jest.MockedFunction<
  typeof isNetworkError
>;
const mockedReconnectWebSocket = reconnectWebSocket as jest.MockedFunction<
  typeof reconnectWebSocket
>;
const mockedIsWebSocketReconnecting =
  isWebSocketReconnecting as jest.MockedFunction<
    typeof isWebSocketReconnecting
  >;

describe('refreshToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the module-level refresh state
    clearRefreshState();
    // The client is injected at runtime (registerApolloClient) rather than
    // imported, so the refresh mutation reads it from the registered reference.
    registerApolloClient(mockedClient);
  });

  describe('isRefreshTokenValid', () => {
    it('returns true when refresh token is valid and not expired', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 86400; // 24 hours
      mockedJwtDecode.mockReturnValue({ exp: futureExp } as JwtPayload);

      expect(isRefreshTokenValid('valid-refresh-token')).toBe(true);
    });

    it('returns false when refresh token is expired', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      mockedJwtDecode.mockReturnValue({ exp: pastExp } as JwtPayload);

      expect(isRefreshTokenValid('expired-refresh-token')).toBe(false);
    });

    it('returns false when refresh token is null', () => {
      expect(isRefreshTokenValid(null)).toBe(false);
    });

    it('returns false when refresh token is empty string', () => {
      // jwtDecode should throw for empty string
      mockedJwtDecode.mockImplementation(() => {
        throw new Error('Invalid token specified');
      });

      expect(isRefreshTokenValid('')).toBe(false);
    });

    it('returns false when jwt decode throws', () => {
      mockedJwtDecode.mockImplementation(() => {
        throw new Error('Malformed token');
      });

      expect(isRefreshTokenValid('bad-token')).toBe(false);
    });

    it('returns true when token expires exactly 1 second from now', () => {
      const exp = Math.floor(Date.now() / 1000) + 1;
      mockedJwtDecode.mockReturnValue({ exp } as JwtPayload);

      expect(isRefreshTokenValid('almost-expired')).toBe(true);
    });

    it('returns false when token just expired (1 second ago)', () => {
      const exp = Math.floor(Date.now() / 1000) - 1;
      mockedJwtDecode.mockReturnValue({ exp } as JwtPayload);

      expect(isRefreshTokenValid('just-expired')).toBe(false);
    });
  });

  describe('getRefreshState', () => {
    it('returns initial state when no refresh is in progress', () => {
      const state = getRefreshState();

      expect(state).toEqual({
        isRefreshing: false,
        refreshPromise: null,
        retryCount: 0,
        lastRefreshTime: 0,
      });
    });

    it('returns a copy of the state (not a reference)', () => {
      const state1 = getRefreshState();
      const state2 = getRefreshState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object references
    });
  });

  describe('clearRefreshState', () => {
    it('resets the refresh state to initial values', () => {
      // Get state, verify initial
      clearRefreshState();
      const state = getRefreshState();

      expect(state.isRefreshing).toBe(false);
      expect(state.refreshPromise).toBeNull();
      expect(state.retryCount).toBe(0);
      expect(state.lastRefreshTime).toBe(0);
    });

    it('is safe to call multiple times', () => {
      clearRefreshState();
      clearRefreshState();
      clearRefreshState();

      const state = getRefreshState();
      expect(state.isRefreshing).toBe(false);
    });
  });

  describe('attemptTokenRefresh', () => {
    const mockOperation = {
      setContext: jest.fn(),
      getContext: jest.fn(() => ({ headers: {} })),
    } as Partial<ApolloLink.Operation> as ApolloLink.Operation & {
      setContext: jest.Mock;
      getContext: jest.Mock;
    };

    const createMockForward = () => {
      const mockForward = jest.fn(() => ({
        subscribe: jest.fn(
          (observer: {
            next: (value: { data: string }) => void;
            complete: () => void;
          }) => {
            observer.next({ data: 'result' });
            observer.complete();
          },
        ),
      }));
      return mockForward as Partial<ApolloLink.ForwardFunction> as ApolloLink.ForwardFunction &
        jest.Mock;
    };

    beforeEach(() => {
      clearRefreshState();
      mockOperation.setContext.mockClear();
      mockOperation.getContext.mockClear();
    });

    it('starts a new refresh when no refresh is in progress', done => {
      const mockSetTokens = jest.fn();
      const mockTokenRefreshFailed = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: mockTokenRefreshFailed,
        setTokens: mockSetTokens,
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      });
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        next: () => {
          expect(mockSetTokens).toHaveBeenCalledWith({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          });
          expect(mockOperation.setContext).toHaveBeenCalled();
          done();
        },
        error: done,
      });
    });

    it('re-forwards with skipErrorLink instead of refreshing again when throttled', done => {
      // A successful refresh stamps lastRefreshTime (preserved across cycles).
      // A second 401 within MIN_REFRESH_INTERVAL must not start another refresh —
      // it re-forwards the op once with skipErrorLink instead.
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        accessToken: 'fresh-token',
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: jest.fn(),
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: 'new-token',
            refreshToken: 'new-refresh',
          },
        },
      });

      // First refresh succeeds and stamps lastRefreshTime.
      const obs1 = attemptTokenRefresh(mockOperation, createMockForward());
      obs1.subscribe({
        next: () => {
          const secondForward = createMockForward();
          const obs2 = attemptTokenRefresh(mockOperation, secondForward);
          obs2.subscribe({
            next: () => {
              // Throttled path: op re-forwarded once, errorLink suppressed,
              // and crucially the refresh mutation was NOT fired a second time.
              expect(secondForward).toHaveBeenCalledWith(mockOperation);
              expect(mockOperation.setContext).toHaveBeenCalledWith({
                skipErrorLink: true,
              });
              expect(mockedClient.mutate).toHaveBeenCalledTimes(1);
              done();
            },
            error: done,
          });
        },
        error: done,
      });
    });

    it('errors when no refresh token available and sets needsTokenRefresh flag', done => {
      const mockSetNeedsTokenRefresh = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: null,
        tokenRefreshFailed: jest.fn(),
        setTokens: jest.fn(),
        setNeedsTokenRefresh: mockSetNeedsTokenRefresh,
      });
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        error: (err: Error) => {
          expect(err).toBeDefined();
          expect(mockSetNeedsTokenRefresh).toHaveBeenCalledWith(true);
          done();
        },
      });
    });

    it('errors when refresh returns invalid response', done => {
      const mockTokenRefreshFailed = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: mockTokenRefreshFailed,
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: null,
            refreshToken: null,
          },
        },
      });
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        error: (err: Error) => {
          expect(err.message).toContain('Missing tokens');
          done();
        },
      });
    });

    it('reconnects websocket after successful refresh', done => {
      const mockSetTokens = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: jest.fn(),
        setTokens: mockSetTokens,
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      });
      mockedIsWebSocketReconnecting.mockReturnValue(false);
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        next: () => {
          expect(mockedReconnectWebSocket).toHaveBeenCalled();
          done();
        },
        error: done,
      });
    });

    it('skips websocket reconnect if already reconnecting', done => {
      const mockSetTokens = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: jest.fn(),
        setTokens: mockSetTokens,
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      });
      mockedIsWebSocketReconnecting.mockReturnValue(true);
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        next: () => {
          expect(mockedReconnectWebSocket).not.toHaveBeenCalled();
          done();
        },
        error: done,
      });
    });

    it('handles token expired error by triggering logout with auth_rejected', done => {
      const mockTokenRefreshFailed = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: mockTokenRefreshFailed,
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockRejectedValue({
        graphQLErrors: [
          { extensions: { code: 'UNAUTHENTICATED' }, message: 'Token expired' },
        ],
      });
      (mockedIsNetworkError as jest.Mock).mockReturnValue(false);
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        error: () => {
          expect(mockTokenRefreshFailed).toHaveBeenCalledWith('auth_rejected');
          done();
        },
      });
    });

    it('handles AUTH_TOKEN_EXPIRED on the refresh mutation itself by triggering logout with auth_rejected', done => {
      const mockTokenRefreshFailed = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'expired-refresh-token',
        tokenRefreshFailed: mockTokenRefreshFailed,
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockRejectedValue({
        graphQLErrors: [
          {
            extensions: { code: 'AUTH_TOKEN_EXPIRED' },
            message: 'Session ended',
          },
        ],
      });
      (mockedIsNetworkError as jest.Mock).mockReturnValue(false);
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        error: () => {
          expect(mockTokenRefreshFailed).toHaveBeenCalledWith('auth_rejected');
          done();
        },
      });
    });

    it('triggers logout when refresh resolves an AuthenticationError union member', done => {
      // `refresh` returns a RefreshResult union, so a rejected refresh token
      // arrives 200 as DATA — errorPolicy can't reject it. It must still end
      // the session rather than fall through to the deferred-retry path.
      const mockTokenRefreshFailed = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'revoked-refresh-token',
        tokenRefreshFailed: mockTokenRefreshFailed,
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'AuthenticationError',
            code: 'AUTH_REFRESH_TOKEN_INVALID',
            message: 'Refresh token has been revoked',
          },
        },
      });
      (mockedIsNetworkError as jest.Mock).mockReturnValue(false);
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        error: () => {
          expect(mockTokenRefreshFailed).toHaveBeenCalledWith('auth_rejected');
          done();
        },
      });
    });

    it('defers instead of logging out when the refusal is a temporary AUTH_ACCOUNT_LOCKED', done => {
      // The API documents the lockout as self-clearing, so the session must
      // survive it — signing the user out would be unrecoverable for a window
      // that expires on its own.
      const mockTokenRefreshFailed = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: mockTokenRefreshFailed,
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'AuthenticationError',
            code: 'AUTH_ACCOUNT_LOCKED',
            message: 'Too many attempts',
          },
        },
      });
      (mockedIsNetworkError as jest.Mock).mockReturnValue(false);
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        error: () => {
          expect(mockTokenRefreshFailed).toHaveBeenCalledWith('unknown');
          expect(mockTokenRefreshFailed).not.toHaveBeenCalledWith(
            'auth_rejected',
          );
          done();
        },
      });
    });

    it('classifies a union refusal by code even when its message reads as a network failure', done => {
      // The message is server-authored free text. If it reached the network
      // heuristics, wording like "unreachable" would spin the refresh in a
      // retry loop against a token the server has permanently rejected.
      const mockTokenRefreshFailed = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'revoked-refresh-token',
        tokenRefreshFailed: mockTokenRefreshFailed,
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'AuthenticationError',
            code: 'AUTH_REFRESH_TOKEN_INVALID',
            message: 'Session store unreachable — token could not be verified',
          },
        },
      });
      // isNetworkError is the real trap: let it match, and assert the
      // code-based branch still wins because it runs first.
      (mockedIsNetworkError as jest.Mock).mockReturnValue(true);
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        error: () => {
          expect(mockTokenRefreshFailed).toHaveBeenCalledWith('auth_rejected');
          expect(mockedClient.mutate).toHaveBeenCalledTimes(1);
          done();
        },
      });
    });

    it('passes errorPolicy: "none" to client.mutate so errors reject and can be classified (not swallowed by the global "all")', done => {
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: jest.fn(),
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      });
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        next: () => {
          const mutateArgs = (mockedClient.mutate as jest.Mock).mock
            .calls[0][0];
          expect(mutateArgs.errorPolicy).toBe('none');
          done();
        },
        error: done,
      });
    });

    it('handles network error without calling tokenRefreshFailed', done => {
      const mockTokenRefreshFailed = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: mockTokenRefreshFailed,
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      const networkErr = new Error('Network request failed');
      (mockedClient.mutate as jest.Mock).mockRejectedValue(networkErr);
      (mockedIsNetworkError as jest.Mock).mockReturnValue(true);
      const mockForward = createMockForward();

      const observable = attemptTokenRefresh(mockOperation, mockForward);
      observable.subscribe({
        error: () => {
          // Network error — should NOT call tokenRefreshFailed at all
          expect(mockTokenRefreshFailed).not.toHaveBeenCalled();
          done();
        },
      });
    }, 30000);
  });

  describe('proactiveTokenRefresh', () => {
    beforeEach(() => {
      clearRefreshState();
    });

    it('returns new access token on success', async () => {
      const mockSetTokens = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: jest.fn(),
        setTokens: mockSetTokens,
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: 'proactive-new-token',
            refreshToken: 'proactive-new-refresh',
          },
        },
      });

      const result = await proactiveTokenRefresh();
      expect(result).toBe('proactive-new-token');
      expect(mockSetTokens).toHaveBeenCalledWith({
        accessToken: 'proactive-new-token',
        refreshToken: 'proactive-new-refresh',
      });
    });

    it('returns null on failure without rethrowing', async () => {
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: null,
        tokenRefreshFailed: jest.fn(),
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });

      const result = await proactiveTokenRefresh();
      expect(result).toBeNull();
    });

    it('returns null on network error without rethrowing', async () => {
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: jest.fn(),
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );
      (mockedIsNetworkError as jest.Mock).mockReturnValue(true);

      const result = await proactiveTokenRefresh();
      expect(result).toBeNull();
    }, 30000);

    it('resets refresh state after completion', async () => {
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: jest.fn(),
        setTokens: jest.fn(),
        setNeedsTokenRefresh: jest.fn(),
      });
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: 'new-token',
            refreshToken: 'new-refresh',
          },
        },
      });

      await proactiveTokenRefresh();
      const state = getRefreshState();
      expect(state.isRefreshing).toBe(false);
      expect(state.refreshPromise).toBeNull();
    });
  });
});
