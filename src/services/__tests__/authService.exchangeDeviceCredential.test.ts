// `authService.exchangeDeviceCredential` answers what the exchange did, one
// outcome per way it can end, so the device decides what to keep from that
// answer alone. Driven by results carrying `data` or `error`, as the client
// resolves them under `errorPolicy: 'all'`.

const mockMutate = jest.fn();
const mockReadFragment = jest.fn();
jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockStore = {
  setAuth: jest.fn(() => true),
  setAuthIsLoading: jest.fn(),
  clearAuth: jest.fn(),
  setHomeAndPantry: jest.fn(),
  setUserNavigationState: jest.fn(),
  setNavigationState: jest.fn(),
  setPreferredCurrency: jest.fn(),
  mirrorSettings: jest.fn(),
  updateUser: jest.fn(),
  getUserNavigationState: jest.fn(() => ({})),
  preferredCurrency: 'USD',
};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStore },
}));

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { onUserChange: jest.fn() },
}));
jest.mock('#/apollo/offlineQueue/queueStore', () => ({
  queueStore: { getCurrentUserId: jest.fn() },
}));
jest.mock('#/hooks/settings/useFeatureHint', () => ({
  incrementLoginCount: jest.fn(),
}));

import { CombinedGraphQLErrors, type ApolloClient } from '@apollo/client';
import { registerApolloClient } from '#/apollo/clientRegistry';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { authService } from '#/services/authService';
import { toastService } from '#/services/toastService';

registerApolloClient({
  mutate: (...args: unknown[]) => mockMutate(...args),
  cache: { readFragment: (...args: unknown[]) => mockReadFragment(...args) },
} as unknown as ApolloClient);

const mockToastError = jest.mocked(toastService.error);

const USER = {
  __typename: 'User',
  id: 'user-1',
  email: 'chef@example.com',
  emailVerified: true,
  onBoarded: true,
  defaultHomeId: null,
  settings: { preferredCurrency: 'USD' },
};

const session = {
  data: {
    exchangeDeviceCredential: {
      __typename: 'DeviceCredentialSessionPayload',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { __typename: 'User', id: USER.id },
    },
  },
};

const refusal = (code: string) => ({
  data: {
    exchangeDeviceCredential: {
      __typename: 'AuthenticationError',
      code,
      message: 'refused',
    },
  },
});

const topLevel = (code: string, retryAfter?: number) => ({
  data: undefined,
  error: new CombinedGraphQLErrors({
    errors: [{ message: 'refused', extensions: { code, retryAfter } }],
  }),
});

const exchange = () =>
  authService.exchangeDeviceCredential('dc1:secret', 'device-1');

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.setAuth.mockReturnValue(true);
  mockReadFragment.mockReturnValue(USER);
});

describe('authService.exchangeDeviceCredential', () => {
  it('signs in with the session the server opened', async () => {
    mockMutate.mockResolvedValueOnce(session);

    await expect(exchange()).resolves.toEqual({ status: 'signedIn' });
    expect(mockStore.setAuth).toHaveBeenCalledWith(USER, 'access', 'refresh');
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: { credential: 'dc1:secret', deviceId: 'device-1' },
        },
      }),
    );
  });

  it('reports a session it could not read as incomplete, and says so', async () => {
    mockMutate.mockResolvedValueOnce(session);
    mockReadFragment.mockReturnValue(null);

    await expect(exchange()).resolves.toEqual({ status: 'incomplete' });
    expect(mockStore.setAuth).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      'Something went wrong. Please try again.',
    );
  });

  it('discards a sign-in that lands while a session ends', async () => {
    mockMutate.mockResolvedValueOnce(session);
    mockStore.setAuth.mockReturnValue(false);

    await expect(exchange()).resolves.toEqual({ status: 'discarded' });
    expect(mockStore.setNavigationState).not.toHaveBeenCalled();
  });

  it('calls the credential dead only when the server says so', async () => {
    mockMutate.mockResolvedValueOnce(refusal('AUTH_DEVICE_CREDENTIAL_INVALID'));

    await expect(exchange()).resolves.toEqual({ status: 'dead' });
    expect(mockToastError).toHaveBeenCalled();
  });

  it('reports any other refusal as refused, with the credential kept', async () => {
    mockMutate.mockResolvedValueOnce(refusal('AUTH_CREDENTIALS_INVALID'));

    await expect(exchange()).resolves.toEqual({ status: 'refused' });
  });

  it('reports a request that never arrived as unreachable', async () => {
    mockMutate.mockResolvedValueOnce({
      data: undefined,
      error: new Error('Network request failed'),
    });

    await expect(exchange()).resolves.toEqual({ status: 'unreachable' });
  });

  it('carries the server’s own deadline on a rate limit', async () => {
    mockMutate.mockResolvedValueOnce(
      topLevel(TopLevelErrorCode.OperationRateLimited, 90),
    );

    await expect(exchange()).resolves.toEqual({
      status: 'failed',
      retryAfterMs: 90_000,
    });
  });
});
