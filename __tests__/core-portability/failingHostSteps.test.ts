/**
 * A host's session steps are its own additions: one that fails is reported, and
 * the core still opens the session the server issued, and still ends one on
 * sign-out. `logout()` is the only sign-out, so nothing a host does may keep a
 * person signed in.
 */
import { createApolloClient } from '#/apollo/client';
import {
  registerSessionHost,
  sessionHost,
  type SessionHost,
} from '#/services/auth/sessionHost';
import { authService } from '#/services/authService';
import { errorService } from '#/services/errorService';
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

const fail = (step: string): Error => new Error(`${step} failed`);

const HOSTS: [string, SessionHost][] = [
  [
    'fail later',
    {
      afterSignIn: () => {
        throw fail('afterSignIn');
      },
      postSignInGate: () => Promise.reject(fail('postSignInGate')),
      forgetStoredSignIn: () => Promise.reject(fail('forgetStoredSignIn')),
      renewStoredSignIn: () => Promise.reject(fail('renewStoredSignIn')),
    },
  ],
  [
    'throw as they are called',
    {
      afterSignIn: () => {
        throw fail('afterSignIn');
      },
      postSignInGate: () => {
        throw fail('postSignInGate');
      },
      forgetStoredSignIn: () => {
        throw fail('forgetStoredSignIn');
      },
      renewStoredSignIn: () => {
        throw fail('renewStoredSignIn');
      },
    },
  ],
];

const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new TypeError('Network request failed')),
  );
  createApolloClient();
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

const reportedSteps = (report: jest.SpyInstance): unknown[] =>
  report.mock.calls.map(
    ([, context]) => (context as { operation: string }).operation,
  );

describe.each(HOSTS)('a host whose steps %s', (_, host) => {
  let report: jest.SpyInstance;

  beforeEach(() => {
    registerSessionHost(host);
    report = jest
      .spyOn(errorService, 'reportError')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    report.mockRestore();
  });

  it('opens the session the server issued and routes into the app', async () => {
    const signInsBefore = useStore.getState().loginCounts[USER.id] ?? 0;

    // `login()` reports success exactly when this resolves.
    await expect(
      authService.handleLogin(
        {
          user: USER,
          accessToken: ACCESS_TOKEN,
          refreshToken: 'refresh-token',
        },
        undefined,
        { email: EMAIL },
      ),
    ).resolves.toBe(false);

    const state = useStore.getState();
    expect(state.user?.id).toBe(USER.id);
    expect(state.accessToken).toBe(ACCESS_TOKEN);
    expect(state.navigationState).toBe('main_app');
    expect(state.loginCounts[USER.id]).toBe(signInsBefore + 1);
    expect(reportedSteps(report)).toEqual([
      'sessionHost.postSignInGate',
      'sessionHost.afterSignIn',
    ]);
  });

  it('signs out', async () => {
    useStore.getState().setAuth(USER, ACCESS_TOKEN, 'refresh-token');

    await authService.logout();

    const state = useStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.navigationState).toBe('auth');
    expect(reportedSteps(report)).toEqual(['sessionHost.forgetStoredSignIn']);
  });

  // A password change this session survived: a failed renewal is the host's
  // to report, and nothing it does may end or alter the session.
  it('keeps the session when renewing a stored sign-in fails', async () => {
    useStore.getState().setAuth(USER, ACCESS_TOKEN, 'refresh-token');

    await expect(sessionHost().renewStoredSignIn(EMAIL)).resolves.toBe('none');

    const state = useStore.getState();
    expect(state.user?.id).toBe(USER.id);
    expect(state.accessToken).toBe(ACCESS_TOKEN);
    expect(reportedSteps(report)).toEqual(['sessionHost.renewStoredSignIn']);
  });
});
