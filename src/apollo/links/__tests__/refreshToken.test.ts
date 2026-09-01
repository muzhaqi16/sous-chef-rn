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
  registerTokenRefresh: jest.fn(),
  registerRefreshInFlightCheck: jest.fn(),
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
import { reconnectWebSocket } from '../wsLink';

const mockedJwtDecode = jwtDecode as jest.MockedFunction<typeof jwtDecode>;
const mockedClient = client as jest.Mocked<typeof client>;
const mockedUseStore = useStore as jest.Mocked<typeof useStore>;
const mockedIsNetworkError = isNetworkError as jest.MockedFunction<
  typeof isNetworkError
>;
const mockedReconnectWebSocket = reconnectWebSocket as jest.MockedFunction<
  typeof reconnectWebSocket
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

    // A refresh token spent by a rotation that beat us to it. The session the
    // winner renewed is alive, so the only wrong move is to end it — and the
    // second-worst is to re-present the token that was just refused, which
    // hot-loops until the server's reuse grace window elapses and then revokes
    // the whole lineage.
    describe('superseded by a concurrent rotation', () => {
      let mockTokenRefreshFailed: jest.Mock;

      /**
       * Refuse the first exchange as superseded, then succeed.
       *
       * `storesSuccessor` is the difference between the two shapes: true means
       * the request that won the race wrote its successor through setTokens as
       * it resolved, so the store answers with a different token by the time we
       * retry. False is the lost-response case, where the winner was us and no
       * successor exists anywhere.
       */
      const supersedeFirstExchange = (storesSuccessor: boolean) => {
        let stored = 'spent-refresh-token';
        let call = 0;

        (mockedUseStore.getState as jest.Mock).mockImplementation(() => ({
          refreshToken: stored,
          tokenRefreshFailed: mockTokenRefreshFailed,
          setTokens: jest.fn(),
          setNeedsTokenRefresh: jest.fn(),
        }));

        (mockedClient.mutate as jest.Mock).mockImplementation(() => {
          call += 1;
          if (call === 1) {
            if (storesSuccessor) stored = 'successor-refresh-token';
            return Promise.resolve({
              data: {
                refresh: {
                  __typename: 'AuthenticationError',
                  code: 'AUTH_REFRESH_TOKEN_SUPERSEDED',
                  message:
                    'Refresh token was superseded by a more recent rotation.',
                },
              },
            });
          }
          return Promise.resolve({
            data: {
              refresh: {
                __typename: 'RefreshTokenPayload',
                accessToken: 'access-from-successor',
                refreshToken: 'refresh-after-successor',
              },
            },
          });
        });
      };

      beforeEach(() => {
        mockTokenRefreshFailed = jest.fn();
        (mockedIsNetworkError as jest.Mock).mockReturnValue(false);
      });

      it('retries with the successor the winner stored, and never ends the session', done => {
        supersedeFirstExchange(true);

        attemptTokenRefresh(mockOperation, createMockForward()).subscribe({
          next: () => {
            const calls = (mockedClient.mutate as jest.Mock).mock.calls;
            expect(calls).toHaveLength(2);
            // The retry presents the successor, NOT the token just refused.
            expect(calls[1][0].variables).toEqual({
              input: { token: 'successor-refresh-token' },
            });
            expect(mockTokenRefreshFailed).not.toHaveBeenCalled();
            done();
          },
        });
      });

      it('defers without re-sending the spent token when no successor was stored', done => {
        // Our own response was the one that got lost, so nothing wrote a
        // successor. Re-sending the spent token would cross the server's
        // ten-second reuse window, and a replay past it revokes the whole
        // lineage — the one move that turns this recoverable refusal into a
        // dead session.
        supersedeFirstExchange(false);

        attemptTokenRefresh(mockOperation, createMockForward()).subscribe({
          error: () => {
            expect((mockedClient.mutate as jest.Mock).mock.calls).toHaveLength(
              1,
            );
            expect(mockTokenRefreshFailed).toHaveBeenCalledWith('unknown');
            expect(mockTokenRefreshFailed).not.toHaveBeenCalledWith(
              'auth_rejected',
            );
            done();
          },
        });
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

  /**
   * The refresh token is single-use, so N concurrent rotations produce one
   * winner and N-1 losers holding a token their own client spent milliseconds
   * earlier. Every entry point therefore shares one exchange.
   */
  describe('single-flight', () => {
    const seedStore = () => {
      const setTokens = jest.fn();
      (mockedUseStore.getState as jest.Mock).mockReturnValue({
        refreshToken: 'mock-refresh-token',
        tokenRefreshFailed: jest.fn(),
        setTokens,
        setNeedsTokenRefresh: jest.fn(),
      });
      return setTokens;
    };

    beforeEach(() => {
      clearRefreshState();
      seedStore();
      (mockedClient.mutate as jest.Mock).mockResolvedValue({
        data: {
          refresh: {
            __typename: 'RefreshTokenPayload',
            accessToken: 'rotated-token',
            refreshToken: 'rotated-refresh',
          },
        },
      });
    });

    it('six concurrent callers spend exactly one rotation', async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, () => proactiveTokenRefresh()),
      );

      expect(mockedClient.mutate).toHaveBeenCalledTimes(1);
      expect(results).toEqual(Array(6).fill('rotated-token'));
    });

    it('a joiner is never turned away by the throttle', async () => {
      // The throttle guards a NEW exchange. Applying it to a caller that would
      // have joined the in-flight one would hand back a null token while a
      // perfectly good rotation was already running.
      const first = proactiveTokenRefresh();
      const joiner = proactiveTokenRefresh();

      expect(await joiner).toBe('rotated-token');
      expect(await first).toBe('rotated-token');
      expect(mockedClient.mutate).toHaveBeenCalledTimes(1);
    });

    it('refuses a new exchange inside MIN_REFRESH_INTERVAL', async () => {
      // authLink AWAITS this once the token is expired, so an unguarded entry
      // point would let a refresh that keeps failing start a fresh doomed
      // exchange per request rather than one per interval.
      await proactiveTokenRefresh();
      expect(mockedClient.mutate).toHaveBeenCalledTimes(1);

      const throttled = await proactiveTokenRefresh();

      expect(throttled).toBeNull();
      expect(mockedClient.mutate).toHaveBeenCalledTimes(1);
    });

    it('allows a new exchange once the interval has passed', async () => {
      await proactiveTokenRefresh();
      const MIN_REFRESH_INTERVAL_MS = 5000;
      const realNow = Date.now;
      jest
        .spyOn(Date, 'now')
        .mockImplementation(() => realNow() + MIN_REFRESH_INTERVAL_MS + 1);

      expect(await proactiveTokenRefresh()).toBe('rotated-token');
      expect(mockedClient.mutate).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });
  });
});
