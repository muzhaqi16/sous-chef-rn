import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { ChangePasswordDocument } from '#operations/auth/auth.generated';
import { PasswordActionStatus } from '#/graphql/generated/schemaTypes';
import {
  registerSessionHost,
  type SessionHost,
  type StoredSignInRenewal,
} from '#/services/auth/sessionHost';
import type { LoginUserFragment } from '#operations/auth/userFragments.generated';
import { useStore } from '#store';
import { useChangePassword } from '#features/profile/hooks/useChangePassword';

const EMAIL = 'chef@example.com';

/** A token the refresh scheduler can read, expiring in an hour. */
const token = (tag: string): string =>
  [
    'e30',
    Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tag }),
    ).toString('base64url'),
    'signature',
  ].join('.');

const OLD_ACCESS = token('old');
const NEW_ACCESS = token('new');

const renewStoredSignIn = jest.fn<Promise<StoredSignInRenewal>, [string]>(() =>
  Promise.resolve('renewed'),
);
const HOST: SessionHost = {
  afterSignIn: () => {},
  postSignInGate: () => Promise.resolve(null),
  forgetStoredSignIn: () => Promise.resolve(),
  renewStoredSignIn,
};

const INPUT = { currentPassword: 'OldPass1', newPassword: 'NewPass1' };

const changed = (
  session: { accessToken: string; refreshToken: string } | null,
) =>
  recordMock(ChangePasswordDocument, {
    data: {
      changePassword: {
        __typename: 'ChangePasswordPayload',
        status: PasswordActionStatus.Completed,
        session: session && { __typename: 'SessionTokens', ...session },
      },
    },
  }).mock;

beforeEach(() => {
  jest.clearAllMocks();
  registerSessionHost(HOST);
  useStore
    .getState()
    .setAuth(
      { id: 'user-1', email: EMAIL } as unknown as LoginUserFragment,
      OLD_ACCESS,
      'old-refresh',
    );
});

describe('useChangePassword', () => {
  // The change refuses every earlier token, this device's included.
  it('keeps this device signed in on the session the server returns', async () => {
    const { result } = renderHookWithApollo(() => useChangePassword(), {
      operationMocks: [
        changed({ accessToken: NEW_ACCESS, refreshToken: 'new-refresh' }),
      ],
    });

    const outcome = await result.current.changePassword(INPUT);

    expect(outcome).toEqual({
      status: 'completed',
      staysSignedIn: true,
      storedSignInDropped: false,
    });
    expect(useStore.getState().accessToken).toBe(NEW_ACCESS);
    expect(useStore.getState().refreshToken).toBe('new-refresh');
    expect(renewStoredSignIn).toHaveBeenCalledWith(EMAIL);
  });

  // Renewing can raise the system prompt; the outcome waits for it, so the
  // screen never moves on beneath it, and says when the sign-in was dropped.
  it('waits for the stored sign-in and reports it dropped', async () => {
    let finishRenewal: (renewal: StoredSignInRenewal) => void = () => {};
    renewStoredSignIn.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishRenewal = resolve;
        }),
    );
    const { result } = renderHookWithApollo(() => useChangePassword(), {
      operationMocks: [
        changed({ accessToken: NEW_ACCESS, refreshToken: 'new-refresh' }),
      ],
    });

    let settled = false;
    const pending = result.current.changePassword(INPUT).then(outcome => {
      settled = true;
      return outcome;
    });
    await waitFor(() => expect(renewStoredSignIn).toHaveBeenCalled());
    expect(settled).toBe(false);

    finishRenewal('dropped');
    expect(await pending).toEqual({
      status: 'completed',
      staysSignedIn: true,
      storedSignInDropped: true,
    });
  });

  // An older server, or a session it could not issue: today's behaviour.
  it('leaves the session alone when no new one comes back', async () => {
    const { result } = renderHookWithApollo(() => useChangePassword(), {
      operationMocks: [changed(null)],
    });

    const outcome = await result.current.changePassword(INPUT);

    expect(outcome).toEqual({
      status: 'completed',
      staysSignedIn: false,
      storedSignInDropped: false,
    });
    expect(useStore.getState().accessToken).toBe(OLD_ACCESS);
    expect(renewStoredSignIn).not.toHaveBeenCalled();
  });

  it('reports a refused change and keeps the session', async () => {
    const { result } = renderHookWithApollo(() => useChangePassword(), {
      operationMocks: [
        recordMock(ChangePasswordDocument, {
          data: {
            changePassword: {
              __typename: 'ChangePasswordPayload',
              status: PasswordActionStatus.InvalidOrExpired,
              session: null,
            },
          },
        }).mock,
      ],
    });

    const outcome = await result.current.changePassword(INPUT);

    expect(outcome.status).toBe('refused');
    expect(useStore.getState().accessToken).toBe(OLD_ACCESS);
    expect(renewStoredSignIn).not.toHaveBeenCalled();
  });
});
