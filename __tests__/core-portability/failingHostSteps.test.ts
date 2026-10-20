/**
 * A host's session steps are its own additions: one that fails is logged, and
 * the core still opens the session the server issued, and still ends one on
 * sign-out. `logout()` is the only sign-out, so nothing a host does may keep a
 * person signed in.
 */
import { createApolloClient } from '#/apollo/client';
import { registerSessionHost } from '#/services/auth/sessionHost';
import { authService } from '#/services/authService';
import type { LoginUserFragment } from '#operations/auth/userFragments.generated';
import { useStore } from '#store';

const EMAIL = 'chef@example.com';

const USER = {
  __typename: 'User',
  id: 'user-1',
  email: EMAIL,
  emailVerified: true,
  onBoarded: true,
  defaultHomeId: null,
  settings: { preferredCurrency: 'USD' },
} as unknown as LoginUserFragment;

/** An access token the refresh scheduler can read, expiring in an hour. */
const ACCESS_TOKEN = [
  'e30',
  Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url'),
  'signature',
].join('.');

const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new TypeError('Network request failed')),
  );
  createApolloClient();
  registerSessionHost({
    afterSignIn: () => {},
    postSignInGate: () => Promise.reject(new Error('gate unavailable')),
    forgetStoredSignIn: () => Promise.reject(new Error('keychain locked')),
  });
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

it('opens the session when the post-sign-in gate fails', async () => {
  await authService.handleLogin(
    { user: USER, accessToken: ACCESS_TOKEN, refreshToken: 'refresh-token' },
    undefined,
    { email: EMAIL },
  );

  const state = useStore.getState();
  expect(state.user?.id).toBe(USER.id);
  expect(state.accessToken).toBe(ACCESS_TOKEN);
});

it('signs out when forgetting the stored sign-in fails', async () => {
  useStore.getState().setAuth(USER, ACCESS_TOKEN, 'refresh-token');

  await authService.logout();

  const state = useStore.getState();
  expect(state.user).toBeNull();
  expect(state.accessToken).toBeNull();
  expect(state.navigationState).toBe('auth');
});
