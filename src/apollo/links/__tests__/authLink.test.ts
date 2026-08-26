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
});

type Headers = Record<string, string>;

/**
 * Drives one operation through `authLink` and resolves with the headers the
 * downstream link was handed — the link's entire observable output.
 */
const run = (operationName: string): Promise<Headers> =>
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
      // awaiting here previously stalled every concurrent request behind one
      // slow refresh. Racing a timer keeps the regression a fast, named failure
      // rather than a suite timeout.
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
});
