// `register` is existence-blind and issues no tokens, so a successful one signs
// in with the password just chosen: `login` admits an unverified account, and
// the verification gate (with its skip) takes over. An address that refuses
// that password — one held by another account, or a deleted one pending
// restoration — reports `verificationSent`, silently, and code entry follows.

jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));
jest.mock('#native/storage/keychain', () =>
  jest.requireActual('#/test-utils/memoryKeychain').memoryKeychainModule(),
);
// Registering the device runs in the background over native device APIs;
// `deviceRegistration.test.ts` covers it.
jest.mock('#/services/device/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));

import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { recordMock, type MockDataFor } from '#/test-utils/apolloMockProvider';
import { registerTestClient } from '#/test-utils/registeredClient';
import { memoryKeychain } from '#/test-utils/memoryKeychain';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { ErrorCode, ErrorDisposition } from '#/graphql/generated/schemaTypes';
import {
  LoginDocument,
  RegisterDocument,
} from '#operations/auth/auth.generated';
import { authService } from '#/services/authService';
import { registerMobileSessionHost } from '#/app/mobileSessionHost';

registerMobileSessionHost();

const INPUT = { name: 'Ada', email: 'ada@example.com', password: 'pw-12345' };
const USER_ID = 'u1';

const registered = () =>
  recordMock(RegisterDocument, {
    data: {
      register: {
        __typename: 'RegisterPayload',
        message: 'A verification link was sent.',
      },
    },
  });

const signingIn = (
  login: MockDataFor<typeof LoginDocument>['login'] = {
    __typename: 'AuthPayload',
    accessToken: 'at',
    refreshToken: 'rt',
    user: {
      __typename: 'User',
      id: USER_ID,
      email: INPUT.email,
      emailVerified: false,
      onBoarded: false,
    },
  },
) => recordMock(LoginDocument, { data: { login } });

const refusedSignIn = (code: ErrorCode) =>
  signingIn({
    __typename: 'AuthenticationError',
    code,
    disposition: ErrorDisposition.Fail,
    message: 'Refused',
  });

beforeEach(() => {
  jest.clearAllMocks();
  memoryKeychain.reset();
  useStore.getState().clearAuth();
  useStore.setState({
    isOnline: true,
    apiReachable: true,
    authIsLoading: false,
    navigationState: 'auth',
  });
});

describe('a new account', () => {
  it('is signed in with the password chosen, so the verification gate takes over', async () => {
    const login = signingIn();
    registerTestClient([registered(), login]);

    const outcome = await authService.register(INPUT);

    expect(outcome).toBe('signedIn');
    expect(login.fired).toEqual([
      { input: { email: INPUT.email, password: INPUT.password } },
    ]);
    const state = useStore.getState();
    expect(state.user?.id).toBe(USER_ID);
    expect(state.navigationState).toBe('verification');
    expect(state.authIsLoading).toBe(false);
  });

  it('starts at the verification step even after an earlier skip', async () => {
    useStore
      .getState()
      .setUserNavigationState(USER_ID, { verificationSkipped: true });
    registerTestClient([registered(), signingIn()]);

    await authService.register(INPUT);

    expect(
      useStore.getState().getUserNavigationState(USER_ID)?.verificationSkipped,
    ).toBe(false);
  });

  it('never has its password written down', async () => {
    registerTestClient([registered(), signingIn()]);

    await authService.register(INPUT);

    expect(memoryKeychain.slotOf(INPUT.email)).toBeUndefined();
    expect(JSON.stringify(useStore.getState())).not.toContain(INPUT.password);
  });
});

describe('an address that refuses the new password', () => {
  it.each([ErrorCode.AuthCredentialsInvalid, ErrorCode.AuthEmailNotVerified])(
    'falls back to code entry without a word on %s',
    async code => {
      // A taken address refuses the new password; a deleted one pending
      // restoration refuses every password until the code is redeemed.
      registerTestClient([registered(), refusedSignIn(code)]);

      const outcome = await authService.register(INPUT);

      expect(outcome).toBe('verificationSent');
      expect(useStore.getState().user).toBeNull();
      expect(toastService.error).not.toHaveBeenCalled();
      expect(useStore.getState().authIsLoading).toBe(false);
    },
  );

  it('falls back to code entry without a word when the sign-in fails in transit', async () => {
    registerTestClient([
      registered(),
      recordMock(LoginDocument, { error: new Error('Network request failed') }),
    ]);

    const outcome = await authService.register(INPUT);

    expect(outcome).toBe('verificationSent');
    expect(toastService.error).not.toHaveBeenCalled();
  });
});

describe('a refused registration', () => {
  it("says the app's own copy and tries no sign-in", async () => {
    const login = signingIn();
    registerTestClient([
      recordMock(RegisterDocument, {
        data: {
          register: {
            __typename: 'ValidationError',
            field: 'email',
            code: ErrorCode.ValidationFailed,
            disposition: ErrorDisposition.Fail,
            message: 'Email is invalid.',
          },
        },
      }),
      login,
    ]);

    const outcome = await authService.register(INPUT);

    expect(outcome).toBe('failed');
    // Never the server's sentence: it is English by construction.
    expect(toastService.error).not.toHaveBeenCalledWith('Email is invalid.');
    expect(toastService.error).toHaveBeenCalledTimes(1);
    expect(login.fired).toEqual([]);
    expect(useStore.getState().authIsLoading).toBe(false);
  });

  it('drops a sign-in token the server no longer honours', async () => {
    useStore.setState({ accessToken: 'stale', refreshToken: 'stale-rt' });
    registerTestClient([
      recordMock(RegisterDocument, {
        error: new CombinedGraphQLErrors({
          data: null,
          errors: [
            {
              message: 'Token expired',
              extensions: { code: ErrorCode.AuthTokenExpired },
            },
          ],
        }),
      }),
    ]);

    await authService.register(INPUT);

    expect(useStore.getState().accessToken).toBeNull();
  });
});
