// Unit tests for the verification-first `authService.register` behavior.
//
// Registration does not authenticate: a `RegisterPayload` result issues NO
// tokens (the user activates via an emailed link, then logs in), so `register`
// must NOT call `store.setAuth`. Error union members surface a toast and keep
// the user on the sign-up screen. `register` uses the singleton Apollo client,
// so we mock `client.mutate` directly (the plain-function analogue of the
// `renderWithApollo` pattern used for hooks).

const mockMutate = jest.fn();
jest.mock('#/apollo/client', () => ({
  client: { mutate: (...args: unknown[]) => mockMutate(...args) },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockStoreSpies = {
  setAuthIsLoading: jest.fn(),
  setRegistrationPassword: jest.fn(),
  setRememberMe: jest.fn(),
  setAuth: jest.fn(),
};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreSpies },
}));

const mockSaveTempPassword = jest.fn().mockResolvedValue(undefined);
const mockClearTempPassword = jest.fn().mockResolvedValue(undefined);
jest.mock('#/storage/keychain', () => ({
  saveTempRegistrationPassword: (...args: unknown[]) =>
    mockSaveTempPassword(...args),
  clearTempRegistrationPassword: (...args: unknown[]) =>
    mockClearTempPassword(...args),
}));

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: { error: (...args: unknown[]) => mockToastError(...args) },
}));

import { authService } from '#/services/authService';

const INPUT = { name: 'Ada', email: 'ada@example.com', password: 'pw-12345' };

const registerPayload = {
  data: {
    register: {
      __typename: 'RegisterPayload',
      status: 'VERIFICATION_SENT',
      message: 'A verification link was sent.',
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authService.register — verification-first', () => {
  it('sends verification without opening a session (no setAuth) on RegisterPayload', async () => {
    mockMutate.mockResolvedValueOnce(registerPayload);

    const ok = await authService.register(INPUT);

    expect(ok).toBe(true);
    // The headline invariant: registration must NOT authenticate.
    expect(mockStoreSpies.setAuth).not.toHaveBeenCalled();
    // Credentials are persisted so the post-verification login can prefill.
    expect(mockStoreSpies.setRegistrationPassword).toHaveBeenCalledWith(
      INPUT.password,
    );
    expect(mockSaveTempPassword).toHaveBeenCalledWith(
      INPUT.email,
      INPUT.password,
    );
    // Loading flag is always reset.
    expect(mockStoreSpies.setAuthIsLoading).toHaveBeenLastCalledWith(false);
  });

  it('is existence-blind: an already-registered email yields the same VERIFICATION_SENT outcome', async () => {
    // The server returns RegisterPayload whether or not the email exists, so
    // the client cannot (and must not) distinguish the two cases.
    mockMutate.mockResolvedValueOnce(registerPayload);

    const ok = await authService.register(INPUT);

    expect(ok).toBe(true);
    expect(mockStoreSpies.setAuth).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('toasts the app’s own copy and does not authenticate on an error union member', async () => {
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

    const ok = await authService.register(INPUT);

    expect(ok).toBe(false);
    // Never the server's sentence: it is English by construction (no
    // `Accept-Language` is sent and the token carries no locale). The refusal
    // resolves through the field it names, then its code, then the app's
    // localized generic.
    expect(mockToastError).not.toHaveBeenCalledWith('Email is invalid.');
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockStoreSpies.setAuth).not.toHaveBeenCalled();
    expect(mockStoreSpies.setRegistrationPassword).not.toHaveBeenCalled();
  });
});
