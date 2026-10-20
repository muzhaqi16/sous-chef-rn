// Unit tests for `authService.login` against the `LoginResult` union, and for
// the biometric sign-in's exchange against the same refusal codes.
//
// `login` does not return a bare `AuthPayload`: a refusal arrives 200 as an
// error union member (`AuthenticationError`, `ValidationError`, …) with no
// transport error, so the success branch must key off `__typename` rather than
// mere presence of `data.login`. `login` uses the singleton Apollo client, so we
// mock `client.mutate` directly (the plain-function analogue of the
// `renderWithApollo` pattern used for hooks).
//
// `errorService` is deliberately NOT mocked — these tests assert that a
// refusal's `code` resolves to the shared user-facing copy, which is the whole
// point of routing union members through the same table as top-level errors.

const mockMutate = jest.fn();
jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockRegisterBiometricRefusal = jest.fn();
const mockStoreSpies = {
  registerBiometricRefusal: mockRegisterBiometricRefusal,
  setAuthIsLoading: jest.fn(),
  setAuthIsLoadingCredentials: jest.fn(),
  setAuth: jest.fn(),
  clearAuth: jest.fn(),
};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreSpies },
}));

const mockClearCredentials = jest.fn().mockResolvedValue(undefined);
const mockHasCredentials = jest.fn().mockResolvedValue(true);
const mockLoadCredentials = jest.fn();
jest.mock('#/services/auth/deviceId');

jest.mock('#native/storage/keychain', () => ({
  clearCredentials: (...args: unknown[]) => mockClearCredentials(...args),
  hasCredentials: (...args: unknown[]) => mockHasCredentials(...args),
  loadCredentials: (...args: unknown[]) => mockLoadCredentials(...args),
  getLastBiometricEmail: jest.fn(),
  saveCredentials: jest.fn(),
  getBiometricCapability: jest.fn(),
  clearTempRegistrationPassword: jest.fn(),
}));

const mockToastError = jest.mocked(toastService.error);

import { registerApolloClient } from '#/apollo/clientRegistry';
import type { ApolloClient } from '@apollo/client';
import { toastService } from '#/services/toastService';
import { authService } from '#/services/authService';
import { biometricService } from '#/services/biometric/deviceCredential';

// The client the code under test reads from the registry.
registerApolloClient({
  mutate: (...args: unknown[]) => mockMutate(...args),
} as unknown as ApolloClient);

const INPUT = { email: 'ada@example.com', password: 'pw-12345' };

const rejection = (code: string, message: string) => ({
  data: { login: { __typename: 'AuthenticationError', code, message } },
});

/** The same refusal on the exchange, which a biometric sign-in runs. */
const exchangeRejection = (code: string, message: string) => ({
  data: {
    exchangeDeviceCredential: {
      __typename: 'AuthenticationError',
      code,
      message,
    },
  },
});

/** A slot holding a device credential — the `dc1:` prefix marks it as one. */
const STORED_CREDENTIAL = 'dc1:issued-secret';

beforeEach(() => {
  jest.clearAllMocks();
  mockHasCredentials.mockResolvedValue(true);
  mockLoadCredentials.mockResolvedValue({
    username: INPUT.email,
    password: STORED_CREDENTIAL,
  });
});

describe('authService.login — LoginResult union', () => {
  it('does not authenticate on an error union member', async () => {
    mockMutate.mockResolvedValueOnce(
      rejection('AUTH_CREDENTIALS_INVALID', 'Bad credentials'),
    );

    const ok = await authService.login(INPUT);

    expect(ok).toBe(false);
    // The headline invariant: a refusal resolves with data and no transport
    // error, so a presence-only check would have opened a session.
    expect(mockStoreSpies.setAuth).not.toHaveBeenCalled();
    expect(mockStoreSpies.setAuthIsLoading).toHaveBeenLastCalledWith(false);
  });

  it('toasts the shared copy for the refusal code, not the raw server message', async () => {
    mockMutate.mockResolvedValueOnce(
      rejection('AUTH_CREDENTIALS_INVALID', 'principal/secret mismatch'),
    );

    await authService.login(INPUT);

    expect(mockToastError).toHaveBeenCalledWith('Invalid email or password');
  });

  it('falls back to the app’s generic copy for a code with no mapped copy', async () => {
    mockMutate.mockResolvedValueOnce({
      data: {
        login: {
          __typename: 'ValidationError',
          field: 'email',
          code: 'SOME_UNMAPPED_CODE',
          message: 'Email is invalid.',
        },
      },
    });

    const ok = await authService.login(INPUT);

    expect(ok).toBe(false);
    // This asserted the SERVER's message as the fallback, which is the leak
    // itself: an unmapped code is exactly when the English would have shown.
    // The fallback is the app's own generic sentence.
    expect(mockToastError).not.toHaveBeenCalledWith('Email is invalid.');
    expect(mockToastError).toHaveBeenCalledWith(
      'Something went wrong. Please try again.',
    );
  });
});

// The server pushes only to a session bound to the device, and `authLink`
// sends the id it already holds — null on a cold identity.
describe('authService.login — device binding', () => {
  it('resolves the device id before the session is minted', async () => {
    const { ensureDeviceId } = require('#/services/auth/deviceId');
    const order: string[] = [];
    (ensureDeviceId as jest.Mock).mockImplementationOnce(() => {
      order.push('ensureDeviceId');
      return Promise.resolve('device_test');
    });
    mockMutate.mockImplementationOnce(() => {
      order.push('Login');
      return Promise.resolve(rejection('AUTH_CREDENTIALS_INVALID', 'x'));
    });

    await authService.login(INPUT);

    expect(order).toEqual(['ensureDeviceId', 'Login']);
  });
});

describe('biometric sign-in — stored-credential lifecycle', () => {
  it('keeps the credential when the exchange is refused as credentials-invalid', async () => {
    mockMutate.mockResolvedValueOnce(
      exchangeRejection('AUTH_CREDENTIALS_INVALID', 'Bad credentials'),
    );

    const ok = await biometricService.signInWithDeviceCredential(INPUT.email);

    expect(ok).toBe(false);
    // AUTH_DEVICE_CREDENTIAL_INVALID, below, is the one clear-the-slot signal
    // `exchangeDeviceCredential` names, so this code is not proof of a dead secret.
    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  it('clears stored credentials when the account is suspended', async () => {
    mockMutate.mockResolvedValueOnce(
      exchangeRejection('AUTH_ACCOUNT_SUSPENDED', 'Account suspended'),
    );

    await biometricService.signInWithDeviceCredential(INPUT.email);

    expect(mockClearCredentials).toHaveBeenCalledWith(INPUT.email);
  });

  // The migration case. An enrolment made before device credentials existed
  // holds a PASSWORD, and replaying it is the thing this whole path removed —
  // so the slot is dropped without the secret reaching the network at all.
  it('never presents a pre-migration password, and clears the slot', async () => {
    mockLoadCredentials.mockResolvedValue({
      username: INPUT.email,
      password: INPUT.password, // unprefixed: the old shape
    });

    const ok = await biometricService.signInWithDeviceCredential(INPUT.email);

    expect(ok).toBe(false);
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockClearCredentials).toHaveBeenCalledWith(INPUT.email);
  });

  // A refusal that says the credential is dead clears the slot; one that says
  // the request did not arrive must not, or a single blip un-enrols the device.
  it('keeps the credential when the exchange fails in transport', async () => {
    mockMutate.mockRejectedValueOnce(new Error('Network request failed'));

    const ok = await biometricService.signInWithDeviceCredential(INPUT.email);

    expect(ok).toBe(false);
    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  it('records no biometric penalty when the request never reached the server', async () => {
    // `biometricRetryAt` and `biometricAttempts` are PERSISTED and deliberately
    // not session-scoped, so a lockout recorded for an outage outlasts it.
    mockMutate.mockResolvedValueOnce({
      data: { exchangeDeviceCredential: null },
      error: new Error('Network request failed'),
    });

    const ok = await biometricService.signInWithDeviceCredential(INPUT.email);

    expect(ok).toBe(false);
    expect(mockClearCredentials).not.toHaveBeenCalled();
    expect(mockRegisterBiometricRefusal).not.toHaveBeenCalled();
  });

  it('still records the penalty when the SERVER refuses', async () => {
    // The counterpart: a real refusal must still hold the button off, or every
    // tap spends another of the server's attempts.
    mockMutate.mockResolvedValueOnce(
      exchangeRejection('AUTH_CREDENTIALS_INVALID', 'Wrong'),
    );

    await biometricService.signInWithDeviceCredential(INPUT.email);

    expect(mockRegisterBiometricRefusal).toHaveBeenCalled();
  });

  it('clears the slot when the credential is revoked or expired', async () => {
    mockMutate.mockResolvedValueOnce(
      exchangeRejection('AUTH_DEVICE_CREDENTIAL_INVALID', 'Revoked'),
    );

    const ok = await biometricService.signInWithDeviceCredential(INPUT.email);

    expect(ok).toBe(false);
    expect(mockClearCredentials).toHaveBeenCalledWith(INPUT.email);
  });

  it('keeps stored credentials through a temporary account lockout', async () => {
    mockMutate.mockResolvedValueOnce(
      exchangeRejection('AUTH_ACCOUNT_LOCKED', 'Too many attempts'),
    );

    const ok = await biometricService.signInWithDeviceCredential(INPUT.email);

    expect(ok).toBe(false);
    // The lockout is self-clearing, so discarding the credentials would force a
    // full biometric re-enrollment over a window that expires on its own.
    expect(mockClearCredentials).not.toHaveBeenCalled();
  });
});
