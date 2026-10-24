import { useStore } from '#store';
import { authService } from '#/services/authService';
import { reconnectWebSocket } from '#/apollo/links/wsLink';
import { registerSessionHost } from '#/services/auth/sessionHost';
import { resetSessionEndingGate, whileSessionEnds } from '#store/sessionEnding';

const mockRenewStoredSignIn = jest.fn();

jest.mock('#/apollo/links/wsLink', () => ({
  ...jest.requireActual('#/apollo/links/wsLink'),
  reconnectWebSocket: jest.fn(),
}));

const NEW_SESSION = { accessToken: 'new-access', refreshToken: 'new-refresh' };

const signedIn = (userId: string) => {
  useStore.setState({
    user: { id: userId, email: `${userId}@example.com` },
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
  } as never);
};

beforeAll(() => {
  registerSessionHost({
    afterSignIn: () => {},
    postSignInGate: () => Promise.resolve(null),
    forgetStoredSignIn: () => Promise.resolve(),
    renewStoredSignIn: email => mockRenewStoredSignIn(email),
    onSessionEnd: () => {},
  });
});

beforeEach(() => {
  jest.mocked(reconnectWebSocket).mockClear();
  mockRenewStoredSignIn.mockReset().mockResolvedValue('renewed');
  resetSessionEndingGate();
});

describe('authService.adoptPasswordChangeSession', () => {
  it('keeps the sender signed in on the new pair, and renews its stored sign-in', async () => {
    signedIn('u1');

    await expect(
      authService.adoptPasswordChangeSession(NEW_SESSION, 'u1'),
    ).resolves.toBe('renewed');

    expect(useStore.getState().refreshToken).toBe('new-refresh');
    expect(mockRenewStoredSignIn).toHaveBeenCalledWith('u1@example.com');
    // The socket was opened on a token the change revoked.
    expect(reconnectWebSocket).toHaveBeenCalledTimes(1);
  });

  // A pair minted for one account must never be stored under another.
  it('discards the pair when another account signed in during the change', async () => {
    signedIn('u2');

    await expect(
      authService.adoptPasswordChangeSession(NEW_SESSION, 'u1'),
    ).resolves.toBe('discarded');

    expect(useStore.getState().refreshToken).toBe('old-refresh');
    expect(mockRenewStoredSignIn).not.toHaveBeenCalled();
    expect(reconnectWebSocket).not.toHaveBeenCalled();
  });

  // A session end mints nothing: the guarded writer refuses inside its scope.
  it('discards the pair when a session end is under way', async () => {
    signedIn('u1');

    const outcome = await whileSessionEnds(() =>
      authService.adoptPasswordChangeSession(NEW_SESSION, 'u1'),
    );

    expect(outcome).toBe('discarded');
    expect(useStore.getState().refreshToken).toBe('old-refresh');
    expect(mockRenewStoredSignIn).not.toHaveBeenCalled();
    // A re-dial here would reopen the socket the teardown drops.
    expect(reconnectWebSocket).not.toHaveBeenCalled();
  });
});
