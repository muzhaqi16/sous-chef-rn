// Unit tests for `authService.register`.
//
// `register` is existence-blind and issues no tokens, so a successful one signs
// in with the password just chosen: `login` admits an unverified account, and
// the verification gate (with its skip) takes over. An address that refuses
// that password — one held by another account, or a deleted one pending
// restoration — reports `verificationSent`, silently, and code entry follows.
// `register` uses the singleton Apollo client, so `client.mutate` is mocked
// directly, answering Register first and Login second.

const mockMutate = jest.fn();
const mockReadFragment = jest.fn();
jest.mock('#/apollo/client', () => ({
  client: {
    mutate: (...args: unknown[]) => mockMutate(...args),
    cache: { readFragment: (...args: unknown[]) => mockReadFragment(...args) },
  },
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockStore = {
  user: null as unknown,
  setAuth: jest.fn(),
  clearAuth: jest.fn(),
  setAuthIsLoading: jest.fn(),
  setRememberMe: jest.fn(),
  setNavigationState: jest.fn(),
  setPostLoginCredentials: jest.fn(),
  setHomeAndPantry: jest.fn(),
  setIsHomeSelectionReady: jest.fn(),
  setSelectedShoppingListId: jest.fn(),
  setPreferredCurrency: jest.fn(),
  getUserNavigationState: jest.fn(),
  setUserNavigationState: jest.fn(),
};
jest.mock('#store', () => ({ useStore: { getState: () => mockStore } }));

const mockKeychainWrites = jest.fn();
jest.mock(
  '#/storage/keychain',
  () =>
    new Proxy(
      {},
      {
        get:
          (_target, name: string) =>
          (...args: unknown[]) =>
            mockKeychainWrites(name, ...args),
      },
    ),
);

jest.mock('#/services/auth/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));
jest.mock('#/hooks/useFeatureHint', () => ({ incrementLoginCount: jest.fn() }));
jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { onLogout: jest.fn(), onUserChange: jest.fn() },
}));
jest.mock('#/apollo/offlineQueue/queueStore', () => ({
  queueStore: { getCurrentUserId: jest.fn(), getPendingCount: () => 0 },
}));
jest.mock('#/storage/deviceId');

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: { error: (...args: unknown[]) => mockToastError(...args) },
}));

import { LoginDocument } from '#operations/auth/auth.generated';
import { authService } from '#/services/authService';

const INPUT = { name: 'Ada', email: 'ada@example.com', password: 'pw-12345' };
const USER_ID = 'u1';

const registered = {
  data: {
    register: {
      __typename: 'RegisterPayload',
      status: 'VERIFICATION_SENT',
      message: 'A verification link was sent.',
    },
  },
};

const signedIn = {
  data: {
    login: {
      __typename: 'AuthPayload',
      accessToken: 'at',
      refreshToken: 'rt',
      user: { __typename: 'User', id: USER_ID },
    },
  },
};

const loginRefused = (code: string) => ({
  data: {
    login: { __typename: 'AuthenticationError', code, message: 'Refused' },
  },
});

const loginCalls = () =>
  mockMutate.mock.calls.filter(
    ([options]: [{ mutation: unknown }]) => options.mutation === LoginDocument,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockReadFragment.mockReturnValue({
    __typename: 'User',
    id: USER_ID,
    email: INPUT.email,
    emailVerified: false,
    onBoarded: false,
    defaultHomeId: null,
  });
});

describe('authService.register', () => {
  it('signs a new account in, so the verification gate and its skip take over', async () => {
    mockMutate.mockResolvedValueOnce(registered).mockResolvedValue(signedIn);

    const outcome = await authService.register(INPUT);

    expect(outcome).toBe('signedIn');
    expect(loginCalls()).toHaveLength(1);
    expect(loginCalls()[0]?.[0]).toMatchObject({
      variables: { input: { email: INPUT.email, password: INPUT.password } },
    });
    expect(mockStore.setAuth).toHaveBeenCalledTimes(1);
    expect(mockStore.setNavigationState).toHaveBeenCalledWith('verification');
    expect(mockStore.setAuthIsLoading).toHaveBeenLastCalledWith(false);
  });

  it.each(['AUTH_CREDENTIALS_INVALID', 'AUTH_EMAIL_NOT_VERIFIED'])(
    'falls back to code entry without a word when sign-in is refused with %s',
    async code => {
      // A taken address refuses the new password; a deleted one pending
      // restoration refuses every password until the code is redeemed.
      mockMutate
        .mockResolvedValueOnce(registered)
        .mockResolvedValueOnce(loginRefused(code));

      const outcome = await authService.register(INPUT);

      expect(outcome).toBe('verificationSent');
      expect(mockStore.setAuth).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockStore.setAuthIsLoading).toHaveBeenLastCalledWith(false);
    },
  );

  it('falls back to code entry without a word when sign-in fails in transit', async () => {
    mockMutate
      .mockResolvedValueOnce(registered)
      .mockRejectedValueOnce(new Error('Network request failed'));

    const outcome = await authService.register(INPUT);

    expect(outcome).toBe('verificationSent');
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('never writes the password down', async () => {
    mockMutate.mockResolvedValueOnce(registered).mockResolvedValue(signedIn);

    await authService.register(INPUT);

    expect(mockKeychainWrites).not.toHaveBeenCalled();
    const storeCalls = Object.values(mockStore).flatMap(value =>
      jest.isMockFunction(value) ? value.mock.calls : [],
    );
    expect(JSON.stringify(storeCalls)).not.toContain(INPUT.password);
  });

  it('toasts the app’s own copy and attempts no sign-in on an error union member', async () => {
    mockMutate.mockResolvedValueOnce({
      data: {
        register: {
          __typename: 'ValidationError',
          field: 'email',
          code: 'VALIDATION',
          message: 'Email is invalid.',
        },
      },
    });

    const outcome = await authService.register(INPUT);

    expect(outcome).toBe('failed');
    // Never the server's sentence: it is English by construction (no
    // `Accept-Language` is sent and the token carries no locale). The refusal
    // resolves through the field it names, then its code, then the app's
    // localized generic.
    expect(mockToastError).not.toHaveBeenCalledWith('Email is invalid.');
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(loginCalls()).toHaveLength(0);
    expect(mockStore.setAuth).not.toHaveBeenCalled();
    expect(mockStore.setAuthIsLoading).toHaveBeenLastCalledWith(false);
  });
});
