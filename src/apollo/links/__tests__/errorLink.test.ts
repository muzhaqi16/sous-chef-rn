'use no memo';

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
jest.mock('../../clientUpgradeNotice', () => ({
  announceClientUpgradeRequired: jest.fn(),
}));
// `endSession` and not `clearAuth`: a server verdict that the session is over
// has to clear the persisted Apollo cache too, or the signed-out account's
// entities are restored for whoever signs in on this device next.
const mockEndSession = jest.fn(() => Promise.resolve());
const mockClearAuth = jest.fn();
jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      endSession: mockEndSession,
      clearAuth: mockClearAuth,
    })),
  },
}));

import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import type { DocumentNode } from '@apollo/client';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { Observable } from 'rxjs';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { FormattedExecutionResult } from 'graphql';
import { errorLink } from '../errorLink';
import { LogoutCleanup } from '../../logoutCleanup';
import { attemptTokenRefresh } from '../refreshToken';
import { isKnownServerError } from '#utils/subscriptionErrorHandler';
import { isNetworkError } from '#/utils/isNetworkError';
import { logger } from '#/utils/environment';
import { announceClientUpgradeRequired } from '../../clientUpgradeNotice';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';

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
  defaultOptions: APOLLO_DEFAULT_OPTIONS,
});

const runLink = (
  error: Error,
  document: DocumentNode = query,
  context: Record<string, unknown> = {},
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const failing = new ApolloLink(
      () =>
        new Observable(observer => {
          observer.error(error);
        }),
    );

    ApolloLink.execute(
      ApolloLink.from([errorLink, failing]),
      { query: document, variables: {}, context },
      { client },
    ).subscribe({
      next: resolve,
      error: reject,
      complete: () => resolve(undefined),
    });
  });

const runWithError = (
  errors: FormattedExecutionResult['errors'],
): Promise<unknown> => runLink(new CombinedGraphQLErrors({ errors }));

const settle = () => undefined;

beforeEach(() => {
  jest.clearAllMocks();
});

const expiredToken = () =>
  new CombinedGraphQLErrors({
    errors: [
      { message: 'Token expired', extensions: { code: 'UNAUTHENTICATED' } },
    ],
  });

// Neither a caller that opts out nor a sign-out in progress gets recovered:
// the refusal reaches the caller as it arrived.
it('leaves an auth refusal alone when the operation sets skipErrorLink', async () => {
  await runLink(expiredToken(), query, { skipErrorLink: true }).catch(settle);

  expect(attemptTokenRefresh).not.toHaveBeenCalled();
});

it('leaves an auth refusal alone while a sign-out is in progress', async () => {
  jest.mocked(LogoutCleanup.isInLogoutProcess).mockReturnValueOnce(true);

  await runLink(expiredToken()).catch(settle);

  expect(attemptTokenRefresh).not.toHaveBeenCalled();
});

describe('errorLink — FEATURE_DISABLED and PREMIUM_REQUIRED', () => {
  // A feature switched off for this user, or one needing a plan they do not
  // hold, asks for their flags again, so every screen stops offering it.
  it.each([
    TopLevelErrorCode.FeatureDisabled,
    TopLevelErrorCode.PremiumRequired,
  ])(
    '%s asks for the flags again, and neither refreshes nor signs out',
    async code => {
      const refetch = jest.spyOn(client, 'refetchQueries').mockReturnValue(
        Object.assign(Promise.resolve([]), {
          queries: [],
          results: [],
        }),
      );

      await expect(
        runWithError([
          {
            message: 'Refused',
            extensions: { code, feature: 'RECIPE_CAPTURE_PHOTO' },
          },
        ]),
      ).rejects.toBeDefined();

      expect(refetch).toHaveBeenCalledWith({
        include: [MyFeatureFlagsDocument],
      });
      expect(attemptTokenRefresh).not.toHaveBeenCalled();
      expect(mockEndSession).not.toHaveBeenCalled();
    },
  );
});

// The key is baked into the build, so its refusals are build faults: no
// refresh can fix them and the session is still valid.
describe('errorLink — API key refusals', () => {
  it.each([
    'API_KEY_MISSING',
    'API_KEY_INVALID',
    'API_KEY_EXPIRED',
    'API_KEY_REVOKED',
  ])(
    'logs %s as a key fault, and neither refreshes nor signs out',
    async code => {
      await runWithError([
        { message: 'Key refused', extensions: { code } },
      ]).catch(settle);

      expect(logger.error).toHaveBeenCalledWith(
        'API Key error:',
        'Key refused',
      );
      expect(attemptTokenRefresh).not.toHaveBeenCalled();
      expect(mockEndSession).not.toHaveBeenCalled();
    },
  );

  // These transpose the real API_KEY_MISSING / API_KEY_INVALID and are not
  // codes the API emits. Pinned so the invented names can't drift back in.
  it.each(['API_KEY_REQUIRED', 'INVALID_API_KEY'])(
    'does not read %s, which the API never emits, as a key fault',
    async code => {
      await runWithError([
        { message: 'Key refused', extensions: { code } },
      ]).catch(settle);

      expect(logger.error).not.toHaveBeenCalledWith(
        'API Key error:',
        expect.anything(),
      );
    },
  );

  // The rate-limit check runs first, so this one never reaches the key branch.
  it('reads API_KEY_RATE_LIMITED as a rate limit, and neither refreshes nor signs out', async () => {
    await runWithError([
      { message: 'Slow down', extensions: { code: 'API_KEY_RATE_LIMITED' } },
    ]).catch(settle);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Rate limited [TestOp]'),
    );
    expect(attemptTokenRefresh).not.toHaveBeenCalled();
    expect(mockEndSession).not.toHaveBeenCalled();
  });

  // A missing permission bails out of the whole handler, so a later auth error
  // in the same response buys no refresh.
  it('bails out on API_KEY_INSUFFICIENT_PERMISSIONS before a later auth error', async () => {
    await runWithError([
      {
        message: 'Missing permission',
        extensions: { code: 'API_KEY_INSUFFICIENT_PERMISSIONS' },
      },
      { message: 'Token expired', extensions: { code: 'UNAUTHENTICATED' } },
    ]).catch(settle);

    expect(attemptTokenRefresh).not.toHaveBeenCalled();
    expect(mockEndSession).not.toHaveBeenCalled();
  });
});

describe('errorLink — an error that is not a GraphQL refusal', () => {
  const subscription = gql`
    subscription TestSub {
      me {
        id
      }
    }
  `;

  it('warns on a known server error over a subscription', async () => {
    jest.mocked(isKnownServerError).mockReturnValueOnce(true);

    await runLink(new Error('stream reset'), subscription).catch(settle);

    expect(logger.warn).toHaveBeenCalledWith(
      'Known server error for TestSub:',
      'stream reset',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs the same error over a query as unexpected', async () => {
    jest.mocked(isKnownServerError).mockReturnValueOnce(true);

    await runLink(new Error('stream reset')).catch(settle);

    expect(logger.error).toHaveBeenCalledWith(
      'Unexpected error [TestOp]:',
      'stream reset',
    );
  });

  // retryLink owns retry and networkStatusLink logs once per operation.
  it('leaves a network error to the links above it', async () => {
    jest.mocked(isNetworkError).mockReturnValueOnce(true);

    await runLink(new Error('Network request failed')).catch(settle);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// The link asks by code only (`isRefreshableAuthCode`, owned by
// authErrorCodes.test.ts): prose that merely sounds auth-shaped buys no
// refresh, nor does a code a new token cannot answer.
it.each([
  [
    'FORBIDDEN',
    { message: 'Access denied', extensions: { code: 'FORBIDDEN' } },
  ],
  ['NOT_FOUND', { message: 'Not found', extensions: { code: 'NOT_FOUND' } }],
  [
    'VALIDATION_FAILED',
    { message: 'Invalid', extensions: { code: 'VALIDATION_FAILED' } },
  ],
  ['an uncoded "Token has expired"', { message: 'Token has expired' }],
  ['an uncoded "Unauthorized access"', { message: 'Unauthorized access' }],
  [
    'an uncoded "The invalid token was provided"',
    { message: 'The invalid token was provided' },
  ],
  ['an uncoded "JWT malformed"', { message: 'JWT malformed' }],
])('does not refresh on %s', async (_, error) => {
  await runWithError([error]).catch(settle);

  expect(attemptTokenRefresh).not.toHaveBeenCalled();
});

// A build below the server's minimum version is refused permanently. Refreshing
// the token succeeds and then fails identically, so the link must not start a
// refresh cycle over it.
describe('errorLink — CLIENT_UPGRADE_REQUIRED', () => {
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

  // The refusal lands on every operation, so without a user-visible signal the
  // app just fails silently everywhere.
  it('announces the upgrade to the user', async () => {
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

    expect(announceClientUpgradeRequired).toHaveBeenCalled();
  });

  it('does not announce for an unrelated error', async () => {
    await runWithError([
      { message: 'Token expired', extensions: { code: 'UNAUTHENTICATED' } },
    ]).catch(() => undefined);

    expect(announceClientUpgradeRequired).not.toHaveBeenCalled();
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

      expect(mockEndSession).toHaveBeenCalledTimes(1);
      expect(mockEndSession).toHaveBeenCalledWith('account_inactive');
      expect(mockClearAuth).not.toHaveBeenCalled();
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

      expect(mockEndSession).toHaveBeenCalledWith('account_inactive');
    });

    // The code is the whole signal. Prose reading as a suspension under any
    // other code is a resource denial the user can recover from, and ending
    // the session over it signs out someone who is still entitled to be here.
    it('does NOT end the session on prose alone under another code', async () => {
      await runWithError([
        {
          message: 'User account is not active',
          extensions: {
            code: 'FORBIDDEN',
            reason: 'User account has been suspended or deleted',
          },
        },
      ]).catch(() => undefined);

      expect(mockEndSession).not.toHaveBeenCalled();
      expect(mockClearAuth).not.toHaveBeenCalled();
    });

    it('ends the session on the code with prose that does not mention it', async () => {
      await runWithError([
        {
          message: 'Nope',
          extensions: {
            code: 'AUTH_ACCOUNT_SUSPENDED',
            reason: 'reworded entirely',
          },
        },
      ]).catch(() => undefined);

      expect(mockEndSession).toHaveBeenCalledWith('account_inactive');
      expect(attemptTokenRefresh).not.toHaveBeenCalled();
    });

    it('plain resource FORBIDDEN does NOT end the session', async () => {
      await runWithError([
        {
          message: 'Access denied',
          extensions: { code: 'FORBIDDEN' },
        },
      ]).catch(() => undefined);

      expect(mockEndSession).not.toHaveBeenCalled();
      expect(mockClearAuth).not.toHaveBeenCalled();
    });
  });

  // The refresh token is gone or rejected, so there is nothing left to
  // exchange and the refresh branch would spend a doomed round trip per
  // failing operation. Arriving on an ordinary operation — the refresh
  // mutation's own rejection is handled in refreshToken.ts.
  describe('dead refresh token on an ordinary operation', () => {
    it.each(['AUTH_REFRESH_TOKEN_INVALID', 'AUTH_REFRESH_TOKEN_MISSING'])(
      'ends the session on %s without attempting a refresh',
      async code => {
        await runWithError([
          { message: 'Refresh token rejected', extensions: { code } },
        ]).catch(() => undefined);

        expect(mockEndSession).toHaveBeenCalledTimes(1);
        expect(mockEndSession).toHaveBeenCalledWith('refresh_token_dead');
        expect(mockClearAuth).not.toHaveBeenCalled();
        expect(attemptTokenRefresh).not.toHaveBeenCalled();
      },
    );

    // The access-token-side refusals stay refreshable: the stored refresh
    // token is untouched, so an exchange still fixes them.
    it('AUTH_TOKEN_EXPIRED still refreshes rather than ending the session', async () => {
      await runWithError([
        {
          message: 'Token expired',
          extensions: { code: 'AUTH_TOKEN_EXPIRED' },
        },
      ]).catch(() => undefined);

      expect(mockEndSession).not.toHaveBeenCalled();
      expect(attemptTokenRefresh).toHaveBeenCalled();
    });
  });
});
