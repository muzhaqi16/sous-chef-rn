// The region currency default: an account with no currency is denominated from
// the device, once, and only when the write is known to have landed.
//
// `errorPolicy: 'all'` is global, so a refused `UpdateAccount` RESOLVES. Latching
// the "applied" flag before reading that outcome leaves the account showing a
// currency the server never recorded, with every cost it takes denominated in
// the one it did — and no second attempt, ever.

const mockMutate = jest.fn();
// `unmaskAuthPayload` reads the LoginUser back out of the cache the mutation
// just wrote, so the double has to answer that read for the login to complete.
const mockReadFragment = jest.fn();
jest.mock('#/apollo/client', () => ({
  client: {
    mutate: (...args: unknown[]) => mockMutate(...args),
    cache: { readFragment: () => mockReadFragment() },
  },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockDeviceRegionCurrency = jest.fn();
jest.mock('#/domain/regionCurrency', () => ({
  deviceRegionCurrency: () => mockDeviceRegionCurrency(),
  isUnchosenCurrency: (code: string | null | undefined) => !code,
}));

interface MockStore {
  preferredCurrency: string;
  navState: Record<string, unknown>;
  setAuthIsLoading: jest.Mock;
  setAuthIsLoadingCredentials: jest.Mock;
  setAuth: jest.Mock;
  clearAuth: jest.Mock;
  setRememberMe: jest.Mock;
  setPreferredCurrency: jest.Mock;
  getUserNavigationState: jest.Mock;
  setUserNavigationState: jest.Mock;
}

const mockStore: MockStore = {
  preferredCurrency: 'USD',
  navState: {},
  setAuthIsLoading: jest.fn(),
  setAuthIsLoadingCredentials: jest.fn(),
  setAuth: jest.fn(),
  clearAuth: jest.fn(),
  setRememberMe: jest.fn(),
  setPreferredCurrency: jest.fn((code: string) => {
    mockStore.preferredCurrency = code;
  }),
  getUserNavigationState: jest.fn(() => mockStore.navState),
  setUserNavigationState: jest.fn((_id: string, patch: object) => {
    Object.assign(mockStore.navState, patch);
  }),
};
jest.mock('#store', () => ({ useStore: { getState: () => mockStore } }));

jest.mock('#/storage/deviceId');
jest.mock('#/storage/keychain', () => ({
  clearCredentials: jest.fn(),
  hasCredentials: jest.fn().mockResolvedValue(false),
  loadCredentials: jest.fn(),
  getLastBiometricEmail: jest.fn(),
  saveCredentials: jest.fn(),
  getBiometricCapability: jest.fn().mockResolvedValue({ isAvailable: false }),
  clearTempRegistrationPassword: jest.fn(),
}));

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn() },
}));

import { authService } from '#/services/authService';

const user = (preferredCurrency: string | null) => ({
  __typename: 'User',
  id: 'u1',
  email: 'ada@example.com',
  emailVerified: true,
  onBoarded: true,
  preferredCurrency,
});

const loginOk = (preferredCurrency: string | null) => ({
  data: {
    login: {
      __typename: 'AuthPayload',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: user(preferredCurrency),
    },
  },
});

const signIn = async (
  preferredCurrency: string | null,
  updateResult: object,
  updateThrows?: Error,
) => {
  mockReadFragment.mockReturnValue(user(preferredCurrency));
  mockMutate.mockResolvedValueOnce(loginOk(preferredCurrency));
  if (updateThrows) {
    mockMutate.mockRejectedValueOnce(updateThrows);
  } else {
    mockMutate.mockResolvedValueOnce(updateResult);
  }
  await authService.login({ email: 'ada@example.com', password: 'pw-12345' });
  // The write is fired without being awaited by `handleLogin`.
  await new Promise(resolve => setImmediate(resolve));
};

const accepted = {
  data: { updateAccount: { __typename: 'UpdateAccountPayload' } },
};
const refused = {
  data: {
    updateAccount: { __typename: 'ValidationError', code: 'BAD', field: 'x' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` leaves queued `mockResolvedValueOnce` values in place, and
  // a case where the update never fires leaves one behind for the next login.
  mockMutate.mockReset();
  mockStore.preferredCurrency = 'USD';
  mockStore.navState = {};
  mockDeviceRegionCurrency.mockReturnValue('EUR');
});

describe('the region currency default', () => {
  it('denominates an account that has never had a currency', async () => {
    await signIn(null, accepted);

    expect(mockStore.setPreferredCurrency).toHaveBeenCalledWith('EUR');
    expect(mockStore.navState.currencyDefaultApplied).toBe(true);
  });

  it('leaves an account that already holds one alone, default or not', async () => {
    await signIn('USD', accepted);

    expect(mockStore.setPreferredCurrency).not.toHaveBeenCalled();
    expect(mockStore.navState.currencyDefaultApplied).toBeUndefined();
  });

  it('reverts and stays unapplied when the write is refused', async () => {
    await signIn(null, refused);

    expect(mockStore.setPreferredCurrency).toHaveBeenLastCalledWith('USD');
    expect(mockStore.navState.currencyDefaultApplied).toBeUndefined();
  });

  it('reverts and stays unapplied when the write cannot be sent', async () => {
    // `errorPolicy: 'all'` makes a REFUSAL resolve, but a transport failure
    // still throws — and offline is the state this runs in most often. An
    // unreverted local value shows a currency the server never recorded.
    await signIn(null, accepted, new Error('Network request failed'));

    expect(mockStore.setPreferredCurrency).toHaveBeenLastCalledWith('USD');
    expect(mockStore.navState.currencyDefaultApplied).toBeUndefined();
  });

  it('does not run again once it has been applied', async () => {
    mockStore.navState = { currencyDefaultApplied: true };

    await signIn(null, accepted);

    expect(mockStore.setPreferredCurrency).not.toHaveBeenCalled();
  });

  it('does nothing where the device names no currency', async () => {
    mockDeviceRegionCurrency.mockReturnValue(null);

    await signIn(null, accepted);

    expect(mockStore.setPreferredCurrency).not.toHaveBeenCalled();
  });
});
