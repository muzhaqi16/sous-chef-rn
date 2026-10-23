// The region currency default: an account with no settings has never been
// denominated, so it is denominated from the device, once, and only when the
// write is known to have landed.
//
// `errorPolicy: 'all'` is global, so a refused `updateSettings` RESOLVES.
// Latching the "applied" flag before reading that outcome leaves the account
// showing a currency the server never recorded, with every cost it takes
// denominated in the one it did — and no second attempt, ever.

const mockMutate = jest.fn();
// `unmaskAuthPayload` reads the LoginUser back out of the cache the mutation
// just wrote, so the double has to answer that read for the login to complete.
const mockReadFragment = jest.fn();
jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
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
  setAuth: jest.Mock;
  clearAuth: jest.Mock;
  setPreferredCurrency: jest.Mock;
  updateUser: jest.Mock;
  getUserNavigationState: jest.Mock;
  setUserNavigationState: jest.Mock;
}

const mockStore: MockStore = {
  preferredCurrency: 'USD',
  navState: {},
  setAuthIsLoading: jest.fn(),
  setAuth: jest.fn(() => true),
  clearAuth: jest.fn(),
  setPreferredCurrency: jest.fn((code: string) => {
    mockStore.preferredCurrency = code;
  }),
  updateUser: jest.fn(),
  getUserNavigationState: jest.fn(() => mockStore.navState),
  setUserNavigationState: jest.fn((_id: string, patch: object) => {
    Object.assign(mockStore.navState, patch);
  }),
};
jest.mock('#store', () => ({ useStore: { getState: () => mockStore } }));

jest.mock('#/services/auth/deviceId');
jest.mock('#native/storage/keychain', () => ({
  clearCredentials: jest.fn(),
  hasCredentials: jest.fn().mockResolvedValue(false),
  loadCredentials: jest.fn(),
  getLastBiometricEmail: jest.fn(),
  saveCredentials: jest.fn(),
  getBiometricCapability: jest.fn().mockResolvedValue({ isAvailable: false }),
}));

import { registerApolloClient } from '#/apollo/clientRegistry';
import type { ApolloClient } from '@apollo/client';
import { authService } from '#/services/authService';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';

// The client the code under test reads from the registry.
registerApolloClient({
  mutate: (...args: unknown[]) => mockMutate(...args),
  cache: { readFragment: () => mockReadFragment() },
} as unknown as ApolloClient);

/** An account's settings row; `null` until its first settings write. */
type Settings = { preferredCurrency: string } | null;

const settingsStating = (preferredCurrency: string): Settings => ({
  preferredCurrency,
});

const user = (settings: Settings) => ({
  __typename: 'User',
  id: 'u1',
  email: 'ada@example.com',
  emailVerified: true,
  onBoarded: true,
  settings: settings && {
    __typename: 'UserSettings',
    id: 'settings-1',
    ...settings,
  },
});

const loginOk = (settings: Settings) => ({
  data: {
    login: {
      __typename: 'AuthPayload',
      accessToken: 'access',
      refreshToken: 'refresh',
      user: user(settings),
    },
  },
});

const signIn = async (
  settings: Settings,
  updateResult: object,
  updateThrows?: Error,
) => {
  mockReadFragment.mockReturnValue(user(settings));
  mockMutate.mockResolvedValueOnce(loginOk(settings));
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
  data: { updateSettings: { __typename: 'UpdateSettingsPayload' } },
};
const refused = {
  data: {
    updateSettings: { __typename: 'ValidationError', code: 'BAD', field: 'x' },
  },
};

/** The settings writes sent, apart from the login that precedes them. */
const settingsWrites = () =>
  mockMutate.mock.calls
    .map(([options]) => options)
    .filter(options => options.mutation === UpdateUserPreferencesDocument);

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
  it('denominates an account that has no settings yet', async () => {
    await signIn(null, accepted);

    expect(mockStore.setPreferredCurrency).toHaveBeenCalledWith('EUR');
    // The settings' own currency, and sent as is: no `localFirst` context, so
    // it is never queued behind a currency the account does not hold.
    expect(settingsWrites()).toEqual([
      {
        mutation: UpdateUserPreferencesDocument,
        variables: { input: { regional: { preferredCurrency: 'EUR' } } },
      },
    ]);
    expect(mockStore.navState.currencyDefaultApplied).toBe(true);
    // The persisted record follows the mirror, so the next launch keeps it.
    expect(mockStore.updateUser).toHaveBeenCalledTimes(1);
    expect(mockStore.updateUser).toHaveBeenCalledWith({
      preferredCurrency: 'EUR',
    });
  });

  it.each(['USD', 'GBP'])(
    'never infers over an account whose settings state %s',
    async stated => {
      // `USD` is the app's own default, and still a currency the account
      // holds: having settings at all is what says it was denominated.
      await signIn(settingsStating(stated), accepted);

      expect(mockStore.setPreferredCurrency).not.toHaveBeenCalled();
      expect(settingsWrites()).toEqual([]);
      expect(mockStore.navState.currencyDefaultApplied).toBeUndefined();
      expect(mockStore.updateUser).not.toHaveBeenCalled();
    },
  );

  it('reverts and stays unapplied when the write is refused', async () => {
    await signIn(null, refused);

    expect(settingsWrites()).toHaveLength(1);
    expect(mockStore.setPreferredCurrency).toHaveBeenLastCalledWith('USD');
    expect(mockStore.preferredCurrency).toBe('USD');
    expect(mockStore.navState.currencyDefaultApplied).toBeUndefined();
    expect(mockStore.updateUser).not.toHaveBeenCalled();
  });

  it('reverts and stays unapplied when the write cannot be sent', async () => {
    // `errorPolicy: 'all'` makes a REFUSAL resolve, but a transport failure
    // still throws — and offline is the state this runs in most often. An
    // unreverted local value shows a currency the server never recorded.
    await signIn(null, accepted, new Error('Network request failed'));

    expect(settingsWrites()).toHaveLength(1);
    expect(mockStore.setPreferredCurrency).toHaveBeenLastCalledWith('USD');
    expect(mockStore.preferredCurrency).toBe('USD');
    expect(mockStore.navState.currencyDefaultApplied).toBeUndefined();
    expect(mockStore.updateUser).not.toHaveBeenCalled();
  });

  it('does not run again once it has been applied', async () => {
    mockStore.navState = { currencyDefaultApplied: true };

    await signIn(null, accepted);

    expect(mockStore.setPreferredCurrency).not.toHaveBeenCalled();
    expect(settingsWrites()).toEqual([]);
    expect(mockStore.updateUser).not.toHaveBeenCalled();
  });

  it('does nothing where the device names no currency', async () => {
    mockDeviceRegionCurrency.mockReturnValue(null);

    await signIn(null, accepted);

    expect(mockStore.setPreferredCurrency).not.toHaveBeenCalled();
    expect(settingsWrites()).toEqual([]);
    expect(mockStore.updateUser).not.toHaveBeenCalled();
  });
});
