// What a password sign-in opens onto: the biometric enrolment gate, the
// RememberMe fallback, or the app; and what it does with a stored fingerprint
// sign-in the server may have revoked meanwhile.

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

import { ApolloLink } from '@apollo/client';
import { recordMock, type MockDataFor } from '#/test-utils/apolloMockProvider';
import { registerTestClient } from '#/test-utils/registeredClient';
import { memoryKeychain } from '#/test-utils/memoryKeychain';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { ensureDeviceId } from '#/services/auth/deviceId';
import {
  LoginDocument,
  MyDeviceCredentialsDocument,
} from '#operations/auth/auth.generated';
import { authService } from '#/services/authService';
import { registerMobileSessionHost } from '#/app/mobileSessionHost';

registerMobileSessionHost();

const INPUT = { email: 'ada@example.com', password: 'pw-12345' };
const USER_ID = 'u1';

const signingIn = (user: { emailVerified?: boolean } = {}) =>
  recordMock(LoginDocument, {
    data: {
      login: {
        __typename: 'AuthPayload',
        accessToken: 'at',
        refreshToken: 'rt',
        user: {
          __typename: 'User',
          id: USER_ID,
          email: INPUT.email,
          emailVerified: true,
          onBoarded: true,
          ...user,
        },
      },
    },
  });

/** The device credentials the server lists for the account. */
type ListedCredential = NonNullable<
  MockDataFor<typeof MyDeviceCredentialsDocument>['deviceCredentials']
>[number];

const listing = (...deviceIds: string[]) =>
  recordMock(MyDeviceCredentialsDocument, {
    data: {
      deviceCredentials: deviceIds.map(
        (deviceId, index): ListedCredential => ({
          __typename: 'DeviceCredential',
          id: `dc-${index}`,
          deviceId,
        }),
      ),
    },
  });

const contexts: Record<string, unknown>[] = [];
const contextLink = new ApolloLink((operation, forward) => {
  contexts.push(operation.getContext());
  return forward(operation);
});

/** Signs in over `answers`, the client registered as the app's. */
async function signIn(...answers: ReturnType<typeof recordMock>[]) {
  registerTestClient([signingIn(), ...answers], [contextLink]);
  return authService.login(INPUT);
}

const declined = (flags: {
  biometricDeclinedPermanently?: boolean;
  credentialPromptDeclined?: boolean;
}) => {
  useStore.getState().setUserNavigationState(USER_ID, flags);
};

const state = () => useStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  contexts.length = 0;
  memoryKeychain.reset();
  useStore.getState().clearAuth();
  useStore.setState({
    isOnline: true,
    apiReachable: true,
    authIsLoading: false,
    navigationState: 'auth',
    postLoginCredentials: null,
    hasStoredCredentials: false,
    userNavigationStates: {},
  });
});

describe('the RememberMe fallback', () => {
  it('is offered when the device cannot do biometrics at all', async () => {
    memoryKeychain.withoutBiometrics();

    await signIn();

    expect(state().postLoginCredentials).toEqual({ email: INPUT.email });
    // The sign-in screen holds for its RememberMe modal.
    expect(state().navigationState).toBe('auth');
  });

  it('is not offered to someone who permanently declined biometrics', async () => {
    // Its slot is the biometric one, so even a device without the hardware
    // does not offer it to someone who refused that.
    memoryKeychain.withoutBiometrics();
    declined({ biometricDeclinedPermanently: true });

    await signIn();

    expect(state().postLoginCredentials).toBeNull();
    expect(state().navigationState).toBe('main_app');
  });

  it('is not offered over a stored sign-in', async () => {
    memoryKeychain.withoutBiometrics();
    memoryKeychain.hold(INPUT.email, 'dc1:secret');

    await signIn();

    expect(state().postLoginCredentials).toBeNull();
    expect(state().navigationState).toBe('main_app');
  });

  it('gives way to the biometric gate where biometrics are available', async () => {
    await signIn();

    expect(state().navigationState).toBe('biometric_setup');
  });
});

describe('a sign-in whose user read comes back incomplete', () => {
  it('reports failure, opens no session, and says so', async () => {
    // Partial: the read the session opens from needs every field, and this
    // answer leaves out whether the address is verified.
    registerTestClient([
      recordMock(LoginDocument, {
        partial: true,
        data: {
          login: {
            __typename: 'AuthPayload',
            accessToken: 'at',
            refreshToken: 'rt',
            user: { __typename: 'User', id: USER_ID, email: INPUT.email },
          },
        },
      }),
    ]);

    const ok = await authService.login(INPUT);

    expect(ok).toBe(false);
    expect(state().user).toBeNull();
    expect(state().navigationState).toBe('auth');
    expect(toastService.error).toHaveBeenCalled();
    expect(state().authIsLoading).toBe(false);
  });
});

describe('an account not yet verified', () => {
  it('goes to verification, its stored sign-in left unasked about', async () => {
    memoryKeychain.hold(INPUT.email, 'dc1:secret');
    const asked = listing();
    registerTestClient([signingIn({ emailVerified: false }), asked]);

    await authService.login(INPUT);

    expect(state().navigationState).toBe('verification');
    expect(memoryKeychain.slotOf(INPUT.email)).toBe('dc1:secret');
    expect(asked.fired).toEqual([]);
  });
});

// A password change or reset revokes this device's credential server-side and
// tells no device, so the slot still reads as set up until something asks.
describe('a stored fingerprint sign-in, after a password sign-in', () => {
  beforeEach(() => {
    memoryKeychain.hold(INPUT.email, 'dc1:secret');
  });

  it('is kept while the server lists it for this device, asked with the sign-in token', async () => {
    const thisDevice = await ensureDeviceId();
    if (!thisDevice) throw new Error('no device id');

    await signIn(listing('other-device', thisDevice));

    expect(contexts).toContainEqual(
      expect.objectContaining({
        signInToken: 'at',
        skipRetryLink: true,
        oneShot: true,
      }),
    );
    expect(memoryKeychain.slotOf(INPUT.email)).toBe('dc1:secret');
    expect(state().navigationState).toBe('main_app');
  });

  it('is removed and set up again once the server no longer lists it', async () => {
    useStore.setState({ hasStoredCredentials: true });

    await signIn(listing('other-device'));

    expect(memoryKeychain.slotOf(INPUT.email)).toBeUndefined();
    expect(state().hasStoredCredentials).toBe(false);
    expect(state().navigationState).toBe('biometric_setup');
  });

  it('is removed without a prompt for someone who declined biometrics', async () => {
    declined({ biometricDeclinedPermanently: true });

    await signIn(listing());

    expect(memoryKeychain.slotOf(INPUT.email)).toBeUndefined();
    expect(state().navigationState).toBe('main_app');
  });

  it('is kept, and not asked about, while the API is unreachable', async () => {
    useStore.setState({ apiReachable: false });
    const asked = listing();

    await signIn(asked);

    expect(asked.fired).toEqual([]);
    expect(memoryKeychain.slotOf(INPUT.email)).toBe('dc1:secret');
    expect(state().navigationState).toBe('main_app');
  });

  it('is kept when the server cannot be asked', async () => {
    useStore.setState({ hasStoredCredentials: true });

    await signIn(
      recordMock(MyDeviceCredentialsDocument, {
        error: new Error('Network request failed'),
      }),
    );

    expect(memoryKeychain.slotOf(INPUT.email)).toBe('dc1:secret');
    expect(state().hasStoredCredentials).toBe(true);
    expect(state().navigationState).toBe('main_app');
  });
});
