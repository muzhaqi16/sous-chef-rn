/**
 * A host that registers no session steps — the web app — signs out through the
 * same core, and nothing of the session survives it: tokens, the cache, queued
 * writes and session-scoped stores. In node, with every React Native package
 * unloadable, so the sign-out also needs nothing from a device.
 */
import { gql } from '@apollo/client';
import { createApolloClient } from '#/apollo/client';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus } from '#/apollo/offlineQueue/types';
import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { requirePlatform } from '#platform/install';
import { authService } from '#/services/authService';
import { useStore } from '#store';

const USER = {
  id: 'user-1',
  email: 'chef@example.com',
  emailVerified: true,
  onBoarded: true,
};

/** An access token the refresh scheduler can read, expiring in an hour. */
const ACCESS_TOKEN = [
  'e30',
  Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url'),
  'signature',
].join('.');

const PROBE = gql`
  query SignOutProbe {
    signOutProbe
  }
`;

const PROBE_WRITE = gql`
  mutation SignOutProbeWrite {
    signOutProbeWrite
  }
`;

const realFetch = globalThis.fetch;

beforeAll(() => {
  // The refresh-token revoke is sent on every sign-out. Here it finds no
  // network and stays parked, as it does offline.
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new TypeError('Network request failed')),
  );
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

it('leaves no tokens, cache, queued writes or session-scoped state', async () => {
  const client = createApolloClient();
  const store = useStore.getState();
  store.setAuth(USER, ACCESS_TOKEN, 'refresh-token');
  store.setHomeAndPantry('home-1', 'pantry-1');
  client.cache.writeQuery({ query: PROBE, data: { signOutProbe: 'held' } });
  queueStore.setCurrentUserId(USER.id);
  queueStore.addMutation({
    id: 'queued-1',
    userId: USER.id,
    operationName: 'SignOutProbeWrite',
    mutation: PROBE_WRITE,
    variables: {},
    status: QueueStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    requiresAuth: true,
  });
  useNotificationStore.getState().setExpirationAction('n-1', 'consumed');

  // Each one held, so an assertion below cannot pass on an empty start.
  expect(useStore.getState().selectedHomeId).toBe('home-1');
  await expect(
    requirePlatform('secureStore').loadSessionTokens(),
  ).resolves.toMatchObject({ status: 'ok' });
  expect(client.cache.readQuery({ query: PROBE })).toEqual({
    signOutProbe: 'held',
  });
  expect(queueStore.getMutationsForUser(USER.id)).toHaveLength(1);
  expect(useNotificationStore.getState().pendingExpirationLinks).not.toEqual(
    {},
  );

  await authService.logout();

  const after = useStore.getState();
  expect(after.user).toBeNull();
  expect(after.accessToken).toBeNull();
  expect(after.refreshToken).toBeNull();
  expect(after.selectedHomeId).toBeNull();
  expect(after.navigationState).toBe('auth');
  await expect(
    requirePlatform('secureStore').loadSessionTokens(),
  ).resolves.toEqual({ status: 'absent' });
  expect(client.cache.readQuery({ query: PROBE })).toBeNull();
  expect(queueStore.getMutationsForUser(USER.id)).toEqual([]);
  expect(useNotificationStore.getState().pendingExpirationLinks).toEqual({});
});
