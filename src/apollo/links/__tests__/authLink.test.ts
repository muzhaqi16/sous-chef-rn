'use no memo';

// Mock store
const mockStoreState = {
  accessToken: null as string | null,
  refreshToken: null as string | null,
  tokenRefreshFailed: jest.fn(),
  setNeedsTokenRefresh: jest.fn(),
  isOnline: true,
};
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => mockStoreState),
  },
}));

// Mock other dependencies that authLink imports
jest.mock('#/config/env', () => ({
  env: { API_KEY: 'test-api-key' },
}));
jest.mock('#/utils/deviceId', () => ({
  getDeviceIdSync: jest.fn(() => 'test-device-id'),
}));
jest.mock('../../logoutCleanup', () => ({
  LogoutCleanup: {
    shouldSkipOperation: jest.fn(() => false),
    isInLogoutProcess: jest.fn(() => false),
  },
}));
jest.mock('../refreshToken', () => ({
  proactiveTokenRefresh: jest.fn(),
}));

import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { Observable, of } from 'rxjs';
import { authLink } from '../authLink';
import { LogoutCleanup } from '../../logoutCleanup';
import { proactiveTokenRefresh } from '../refreshToken';

const shouldSkipOperation = LogoutCleanup.shouldSkipOperation as jest.Mock;
const mockedProactiveRefresh = proactiveTokenRefresh as jest.Mock;

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * A real, decodable JWT — `authLink` runs the actual `jwt-decode` against it,
 * so the expiry arithmetic under test is the shipped one rather than a copy
 * of it written in this file.
 */
const makeToken = (expiresInSeconds: number): string => {
  const encode = (part: object) =>
    Buffer.from(JSON.stringify(part)).toString('base64url');
  return [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
    'signature',
  ].join('.');
};

// ApolloLink.execute needs a client on its context; the canned link below
// terminates the chain, so this one never reaches the network.
const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.empty(),
  // Same defaults as the app, so a test client cannot behave differently
  // from production (notably `errorPolicy: 'all'`).
  defaultOptions: APOLLO_DEFAULT_OPTIONS,
});

type Headers = Record<string, string>;

/**
 * Drives one operation through `authLink` and resolves with the headers the
 * downstream link was handed — the link's entire observable output.
 */
const run = (
  operationName: string,
  context: Record<string, unknown> = {},
): Promise<Headers> =>
  new Promise((resolve, reject) => {
    let headers: Headers = {};
    const downstream = new ApolloLink(
      operation =>
        new Observable(observer => {
          headers = (operation.getContext().headers ?? {}) as Headers;
          observer.next({ data: null });
          observer.complete();
        }),
    );

    ApolloLink.execute(
      ApolloLink.from([authLink, downstream]),
      {
        query: gql`
          query ${operationName} {
            me {
              id
            }
          }
        `,
        variables: {},
        context,
      },
      { client },
    ).subscribe({
      error: reject,
      complete: () => resolve(headers),
    });
  });

/** Drives an operation expected to fail, resolving with the error it produced. */
const runExpectingError = (operationName: string): Promise<Error> =>
  new Promise((resolve, reject) => {
    ApolloLink.execute(
      ApolloLink.from([authLink, new ApolloLink(() => of({ data: null }))]),
      {
        query: gql`
          query ${operationName} {
            me {
              id
            }
          }
        `,
        variables: {},
      },
      { client },
    ).subscribe({
      error: resolve,
      complete: () => reject(new Error('expected the operation to error')),
    });
  });

describe('authLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.accessToken = null;
    mockStoreState.refreshToken = null;
    mockStoreState.isOnline = true;
    shouldSkipOperation.mockReturnValue(false);
    mockedProactiveRefresh.mockResolvedValue('new-token');
  });

  describe('headers', () => {
    it('sends the API key and device ID on every request', async () => {
      const headers = await run('GetPantry');

      expect(headers['x-api-key']).toBe('test-api-key');
      expect(headers['x-device-id']).toBe('test-device-id');
    });

    it('attaches the bearer token when one is held', async () => {
      mockStoreState.accessToken = makeToken(3600);

      const headers = await run('GetPantry');

      expect(headers.authorization).toBe(
        `Bearer ${mockStoreState.accessToken}`,
      );
    });

    it('omits the authorization header when no token is held', async () => {
      const headers = await run('GetPantry');

      expect(headers).not.toHaveProperty('authorization');
      // The unauthenticated request still identifies the client.
      expect(headers['x-api-key']).toBe('test-api-key');
    });

    it.each(['RefreshToken', 'Login', 'Register', 'SignUp'])(
      'omits the authorization header on the public operation %s',
      async operationName => {
        mockStoreState.accessToken = makeToken(3600);

        const headers = await run(operationName);

        expect(headers).not.toHaveProperty('authorization');
        expect(headers['x-api-key']).toBe('test-api-key');
        expect(headers['x-device-id']).toBe('test-device-id');
      },
    );

    it('treats operation names as exact, not as prefixes', async () => {
      // 'LoginHistory' merely starts with a public operation name; it is a
      // normal authenticated query and must carry the token.
      mockStoreState.accessToken = makeToken(3600);

      const headers = await run('LoginHistory');

      expect(headers.authorization).toBe(
        `Bearer ${mockStoreState.accessToken}`,
      );
    });
  });

  describe('logout in progress', () => {
    it('cancels the operation instead of sending it', async () => {
      shouldSkipOperation.mockReturnValue(true);

      const error = await runExpectingError('GetPantry');

      expect(error.message).toContain('Operation cancelled');
    });

    it('consults the cleanup gate with the operation name', async () => {
      await run('GetPantry');

      expect(shouldSkipOperation).toHaveBeenCalledWith('GetPantry');
    });

    // The sign-out's own device delete dispatches before the gate closes and
    // resolves after it; without the opt-in the logout cancels its own cleanup.
    it('lets a call opted in with allowDuringLogout through', async () => {
      shouldSkipOperation.mockReturnValue(true);
      mockStoreState.accessToken = makeToken(3600);

      const headers = await run('UpdateDevice', { allowDuringLogout: true });

      expect(headers.authorization).toBe(
        `Bearer ${mockStoreState.accessToken}`,
      );
    });

    // Rotating here would write a fresh pair into the store and Keychain right
    // after resetStore cleared them, re-arming the session being ended.
    it('never rotates a token for an opted-in call', async () => {
      shouldSkipOperation.mockReturnValue(true);
      mockStoreState.accessToken = makeToken(120); // inside the 5-minute buffer

      await run('UpdateDevice', { allowDuringLogout: true });

      expect(mockedProactiveRefresh).not.toHaveBeenCalled();
    });
  });

  describe('a token approaching expiry, while online', () => {
    it('fires a server refresh', async () => {
      mockStoreState.accessToken = makeToken(120); // inside the 5-minute buffer

      await run('GetPantry');

      expect(mockedProactiveRefresh).toHaveBeenCalled();
      expect(mockStoreState.setNeedsTokenRefresh).not.toHaveBeenCalled();
    });

    it('does not block the request on that refresh completing', async () => {
      // The refresh never settles. The token is still valid for the rest of the
      // buffer window, so the request must go out immediately carrying it —
      // awaiting here stalls every concurrent request behind one slow refresh.
      // Racing a timer keeps the regression a fast, named failure rather than a
      // suite timeout.
      mockedProactiveRefresh.mockReturnValue(new Promise(() => {}));
      mockStoreState.accessToken = makeToken(120);

      const stalled = Symbol('stalled');
      // Held so the loser can be cancelled: on the passing path the request
      // wins the race and this timer would otherwise stay armed for its full
      // 500ms after the test ends, which is enough to stop the Jest worker
      // exiting on its own.
      let stallTimer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        run('GetPantry'),
        new Promise<typeof stalled>(resolve => {
          stallTimer = setTimeout(() => resolve(stalled), 500);
        }),
      ]);
      clearTimeout(stallTimer);

      expect(outcome).not.toBe(stalled);
      expect((outcome as Headers).authorization).toBe(
        `Bearer ${mockStoreState.accessToken}`,
      );
    });

    it('sends the token it currently holds, not one the refresh will produce', async () => {
      const current = makeToken(120);
      mockStoreState.accessToken = current;

      const headers = await run('GetPantry');

      expect(headers.authorization).toBe(`Bearer ${current}`);
      expect(headers.authorization).not.toContain('new-token');
    });
  });

  describe('a token approaching expiry, while offline', () => {
    beforeEach(() => {
      mockStoreState.isOnline = false;
    });

    it('defers the refresh rather than attempting one', async () => {
      mockStoreState.accessToken = makeToken(120);

      await run('GetPantry');

      expect(mockStoreState.setNeedsTokenRefresh).toHaveBeenCalledWith(true);
      expect(mockedProactiveRefresh).not.toHaveBeenCalled();
    });

    it('still sends the expiring token so a cached read can proceed', async () => {
      mockStoreState.accessToken = makeToken(120);

      const headers = await run('GetPantry');

      expect(headers.authorization).toBe(
        `Bearer ${mockStoreState.accessToken}`,
      );
    });

    // The failure mode this whole path exists to prevent: an expiring token
    // while offline must never be read as a dead session. Only a
    // server-confirmed 401 (handled in refreshToken.ts) may end one.
    it.each([
      ['expiring', 120],
      ['already expired', -60],
    ])('never invalidates the session for an %s token', async (_case, ttl) => {
      mockStoreState.accessToken = makeToken(ttl);

      await run('GetPantry');

      expect(mockStoreState.tokenRefreshFailed).not.toHaveBeenCalled();
    });

    it('never invalidates the session for an undecodable token', async () => {
      mockStoreState.accessToken = 'not-a-jwt';

      await run('GetPantry');

      expect(mockStoreState.tokenRefreshFailed).not.toHaveBeenCalled();
    });
  });

  describe('token expiry classification', () => {
    it('leaves a token outside the buffer alone', async () => {
      mockStoreState.accessToken = makeToken(3600);

      await run('GetPantry');

      expect(mockedProactiveRefresh).not.toHaveBeenCalled();
      expect(mockStoreState.setNeedsTokenRefresh).not.toHaveBeenCalled();
    });

    it('leaves a token just outside the buffer alone', async () => {
      mockStoreState.accessToken = makeToken(REFRESH_BUFFER_MS / 1000 + 60);

      await run('GetPantry');

      expect(mockedProactiveRefresh).not.toHaveBeenCalled();
    });

    it('refreshes a token just inside the buffer', async () => {
      mockStoreState.accessToken = makeToken(REFRESH_BUFFER_MS / 1000 - 60);

      await run('GetPantry');

      expect(mockedProactiveRefresh).toHaveBeenCalled();
    });

    it('refreshes an already-expired token', async () => {
      mockStoreState.accessToken = makeToken(-60);

      await run('GetPantry');

      expect(mockedProactiveRefresh).toHaveBeenCalled();
    });

    it('treats an undecodable token as expiring', async () => {
      mockStoreState.accessToken = 'not-a-jwt';

      await run('GetPantry');

      expect(mockedProactiveRefresh).toHaveBeenCalled();
    });

    it('does not attempt a refresh when there is no token at all', async () => {
      await run('GetPantry');

      expect(mockedProactiveRefresh).not.toHaveBeenCalled();
      expect(mockStoreState.setNeedsTokenRefresh).not.toHaveBeenCalled();
    });
  });

  describe('a token that has already expired, while online', () => {
    it('sends the refreshed token, never the dead one', async () => {
      const expired = makeToken(-60);
      mockStoreState.accessToken = expired;
      mockedProactiveRefresh.mockResolvedValue('rotated-token');

      const headers = await run('GetPantry');

      expect(headers.authorization).toBe('Bearer rotated-token');
      expect(headers.authorization).not.toContain(expired);
    });

    it('holds the request until the refresh settles', async () => {
      let releaseRefresh: (token: string) => void = () => {};
      mockedProactiveRefresh.mockReturnValue(
        new Promise<string>(resolve => {
          releaseRefresh = resolve;
        }),
      );
      mockStoreState.accessToken = makeToken(-60);

      const inFlight = run('GetPantry');
      let settled = false;
      void inFlight.then(() => {
        settled = true;
      });
      // Drain the microtask queue. A fire-and-forget link would have sent the
      // request — on the dead token — by this point.
      await new Promise(resolve => setImmediate(resolve));
      expect(settled).toBe(false);

      releaseRefresh('rotated-token');
      expect((await inFlight).authorization).toBe('Bearer rotated-token');
    });

    it('never lets a concurrent batch go out on the dead token', async () => {
      const expired = makeToken(-60);
      mockStoreState.accessToken = expired;
      mockedProactiveRefresh.mockResolvedValue('rotated-token');

      const batch = await Promise.all(
        [
          'GetPantry',
          'GetShoppingList',
          'GetRecipes',
          'GetNotifications',
          'GetHome',
          'GetMealPlan',
        ].map(name => run(name)),
      );

      // The reported production signature: six concurrent requests carrying the
      // same expired JWT, each drawing its own 401 and its own rotation.
      expect(batch.map(headers => headers.authorization)).toEqual(
        Array(6).fill('Bearer rotated-token'),
      );
    });

    it('falls back to the held token when the refresh cannot complete', async () => {
      // An offline or refused refresh resolves null. Sending nothing would turn
      // a recoverable expiry into an unauthenticated request; the reactive 401
      // path is what decides whether the session is actually over.
      const expired = makeToken(-60);
      mockStoreState.accessToken = expired;
      mockedProactiveRefresh.mockResolvedValue(null);

      const headers = await run('GetPantry');

      expect(headers.authorization).toBe(`Bearer ${expired}`);
      expect(mockStoreState.tokenRefreshFailed).not.toHaveBeenCalled();
    });

    it('falls back to the held token when the refresh REJECTS', async () => {
      // `?? token` only absorbs a resolved null. The single-flight JOIN branch
      // hands back the in-flight promise unwrapped, and that promise rejects on
      // every path `performTokenRefresh` throws on — a rotation lost to a flaky
      // network among them. A joiner must land here, not fail its operation.
      const expired = makeToken(-60);
      mockStoreState.accessToken = expired;
      mockedProactiveRefresh.mockRejectedValue(new Error('Refresh failed'));

      const headers = await run('GetPantry');

      expect(headers.authorization).toBe(`Bearer ${expired}`);
      expect(mockStoreState.tokenRefreshFailed).not.toHaveBeenCalled();
    });

    it('keeps a concurrent batch alive when the shared refresh rejects', async () => {
      // Five joiners behind one owner: the owner converts its own failure to
      // null, so a rejection reaching the link is by definition a joiner's.
      const expired = makeToken(-60);
      mockStoreState.accessToken = expired;
      mockedProactiveRefresh.mockRejectedValue(new Error('Refresh failed'));

      const batch = await Promise.all(
        Array.from({ length: 6 }, () => run('GetPantry')),
      );

      expect(batch.map(headers => headers.authorization)).toEqual(
        Array(6).fill(`Bearer ${expired}`),
      );
    });
  });
});
