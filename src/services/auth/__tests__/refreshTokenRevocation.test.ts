// Push delivery follows a live session, so every session end must reach
// `POST /revoke` — now, or once the API is reachable again.

import type * as Revocation from '../refreshTokenRevocation';

const mockStoreState: Record<string, unknown> = {};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreState },
}));

let mockParked: { refreshToken: string; accessToken: string | null }[] = [];
const mockAddPending = jest.fn(
  (entry: { refreshToken: string; accessToken: string | null }) => {
    mockParked = [
      ...mockParked.filter(p => p.refreshToken !== entry.refreshToken),
      entry,
    ];
    return Promise.resolve(true);
  },
);
jest.mock('#/storage/keychain', () => ({
  addPendingRevocation: (entry: {
    refreshToken: string;
    accessToken: string | null;
  }) => mockAddPending(entry),
  loadPendingRevocations: () => Promise.resolve([...mockParked]),
  removePendingRevocation: (refreshToken: string) => {
    mockParked = mockParked.filter(p => p.refreshToken !== refreshToken);
    return Promise.resolve();
  },
}));

const mockFetch = jest.fn();
const originalFetch = global.fetch;

const respond = (status: number) =>
  mockFetch.mockResolvedValue({ ok: status >= 200 && status < 300, status });

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

// Loaded per test after `resetModules`: the module registers its teardown step
// at init, into the fresh `sessionTeardown` registry `endSession` reads.
const loadRevocation = (): typeof Revocation =>
  jest.requireActual('../refreshTokenRevocation');

beforeEach(() => {
  jest.resetModules();
  mockParked = [];
  mockAddPending.mockClear();
  mockFetch.mockReset();
  global.fetch = mockFetch;
  const { Environment } = require('#/utils/environment');
  (Environment.getApiConfig as jest.Mock).mockReturnValue({
    baseUrl: 'http://localhost:4000/graphql',
  });
  Object.assign(mockStoreState, {
    isOnline: true,
    apiReachable: true,
    offlineModeEnabled: false,
    refreshToken: 'refresh-1',
    accessToken: 'access-1',
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

const endSession = async () => {
  require('#store/sessionTeardown').runSessionTeardown();
  await flush();
};

describe('a session end', () => {
  beforeEach(() => {
    loadRevocation();
  });

  it('posts the refresh token to /revoke with the access token to denylist', async () => {
    respond(200);

    await endSession();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/revoke',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'refresh-1' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer access-1',
        }),
      }),
    );
    expect(mockParked).toEqual([]);
  });

  it('parks the token before the network, so a kill mid-request loses nothing', async () => {
    mockFetch.mockImplementation(() => new Promise(() => undefined));

    await endSession();

    expect(mockParked).toEqual([
      { refreshToken: 'refresh-1', accessToken: 'access-1' },
    ]);
  });

  it('reads the tokens before the rest of the teardown clears them', async () => {
    respond(200);
    const { registerSessionTeardown } = require('#store/sessionTeardown');
    registerSessionTeardown('apollo', () => {
      mockStoreState.refreshToken = null;
      mockStoreState.accessToken = null;
    });

    await endSession();

    expect(mockAddPending).toHaveBeenCalledWith({
      refreshToken: 'refresh-1',
      accessToken: 'access-1',
    });
  });

  it('parks without a request while offline', async () => {
    mockStoreState.isOnline = false;
    mockStoreState.apiReachable = null;

    await endSession();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockParked).toHaveLength(1);
  });

  it.each([500, 503, 429])(
    'keeps the token parked on HTTP %i',
    async status => {
      respond(status);

      await endSession();

      expect(mockParked).toHaveLength(1);
    },
  );

  it('keeps the token parked when the request never reaches the API', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    await endSession();

    expect(mockParked).toHaveLength(1);
  });

  it('drops a token the server refuses for good', async () => {
    respond(400);

    await endSession();

    expect(mockParked).toEqual([]);
  });

  it('does nothing when no session was held', async () => {
    mockStoreState.refreshToken = null;

    await endSession();

    expect(mockAddPending).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('drainPendingRevocations', () => {
  it('revokes what an offline sign-out parked once the API is reachable', async () => {
    mockParked = [
      { refreshToken: 'old-1', accessToken: null },
      { refreshToken: 'old-2', accessToken: 'a-2' },
    ];
    respond(200);

    await loadRevocation().drainPendingRevocations();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockParked).toEqual([]);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('stops at the first unanswered request and keeps the rest', async () => {
    mockParked = [
      { refreshToken: 'old-1', accessToken: null },
      { refreshToken: 'old-2', accessToken: null },
    ];
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    await loadRevocation().drainPendingRevocations();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockParked).toHaveLength(2);
  });

  it('sends nothing while the network is withheld', async () => {
    mockParked = [{ refreshToken: 'old-1', accessToken: null }];
    mockStoreState.offlineModeEnabled = true;

    await loadRevocation().drainPendingRevocations();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockParked).toHaveLength(1);
  });

  it('runs one drain at a time', async () => {
    mockParked = [{ refreshToken: 'old-1', accessToken: null }];
    respond(200);
    const { drainPendingRevocations } = loadRevocation();

    await Promise.all([drainPendingRevocations(), drainPendingRevocations()]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
