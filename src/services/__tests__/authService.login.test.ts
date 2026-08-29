// Unit tests for `authService.login` / `authService.autoLogin` against the
// `LoginResult` union.
//
// `login` no longer returns a bare `AuthPayload`: a refusal arrives 200 as an
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
  client: { mutate: (...args: unknown[]) => mockMutate(...args) },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockStoreSpies = {
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
const mockGetLastBiometricEmail = jest.fn();
jest.mock('#/storage/keychain', () => ({
  clearCredentials: (...args: unknown[]) => mockClearCredentials(...args),
  hasCredentials: (...args: unknown[]) => mockHasCredentials(...args),
  loadCredentials: (...args: unknown[]) => mockLoadCredentials(...args),
  getLastBiometricEmail: () => mockGetLastBiometricEmail(),
  saveCredentials: jest.fn(),
  getStoredAccounts: jest.fn(),
  getBiometricCapability: jest.fn(),
  saveTempRegistrationPassword: jest.fn(),
  clearTempRegistrationPassword: jest.fn(),
}));

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: { error: (...args: unknown[]) => mockToastError(...args) },
}));

import { authService } from '#/services/authService';

const INPUT = { email: 'ada@example.com', password: 'pw-12345' };

const rejection = (code: string, message: string) => ({
  data: { login: { __typename: 'AuthenticationError', code, message } },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetLastBiometricEmail.mockResolvedValue(INPUT.email);
  mockHasCredentials.mockResolvedValue(true);
  mockLoadCredentials.mockResolvedValue({
    username: INPUT.email,
    password: INPUT.password,
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

describe('authService.autoLogin — stored-credential lifecycle', () => {
  it('clears stored credentials when the password no longer authenticates', async () => {
    mockMutate.mockResolvedValueOnce(
      rejection('AUTH_CREDENTIALS_INVALID', 'Bad credentials'),
    );

    const ok = await authService.autoLogin();

    expect(ok).toBe(false);
    // Stale credentials must not survive — otherwise auto-login retries the
    // same rejected password on every cold start.
    expect(mockClearCredentials).toHaveBeenCalledWith(INPUT.email);
  });

  it('clears stored credentials when the account is suspended', async () => {
    mockMutate.mockResolvedValueOnce(
      rejection('AUTH_ACCOUNT_SUSPENDED', 'Account suspended'),
    );

    await authService.autoLogin();

    expect(mockClearCredentials).toHaveBeenCalledWith(INPUT.email);
  });

  it('keeps stored credentials through a temporary account lockout', async () => {
    mockMutate.mockResolvedValueOnce(
      rejection('AUTH_ACCOUNT_LOCKED', 'Too many attempts'),
    );

    const ok = await authService.autoLogin();

    expect(ok).toBe(false);
    // The lockout is self-clearing, so discarding the credentials would force a
    // full biometric re-enrollment over a window that expires on its own.
    expect(mockClearCredentials).not.toHaveBeenCalled();
  });
});
