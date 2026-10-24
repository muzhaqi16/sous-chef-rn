/**
 * Only a sign-out the person chose deletes their queued writes. A password-reset
 * link ends the session without that choice; a server-ended session keeps them
 * for the next sign-in; and a sign-out that arrives while a server end is still
 * running is still the person's choice, so it drops them once that end is done.
 */
import { createApolloClient } from '#/apollo/client';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus } from '#/apollo/offlineQueue/types';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { CreateStorageLocationDocument } from '#features/catalog/graphql/storageLocation.generated';
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

const realFetch = globalThis.fetch;

beforeAll(() => {
  // The refresh-token revoke every end sends finds no network and stays parked.
  globalThis.fetch = jest.fn(() =>
    Promise.reject(new TypeError('Network request failed')),
  );
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

/**
 * Signed in, with one offline write waiting. A real operation: a reload of the
 * queue drops an entry whose operation this build does not send.
 */
function signedInWithQueuedWrite() {
  createApolloClient();
  useStore.getState().setAuth(USER, ACCESS_TOKEN, 'refresh-token');
  useStore.getState().setNavigationState('main_app');
  queueStore.setCurrentUserId(USER.id);
  queueStore.addMutation({
    id: 'queued-1',
    userId: USER.id,
    operationName: operationNameOf(CreateStorageLocationDocument),
    mutation: CreateStorageLocationDocument,
    variables: {},
    status: QueueStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    requiresAuth: true,
  });
  expect(queueStore.getMutationsForUser(USER.id)).toHaveLength(1);
}

afterEach(() => {
  queueStore.clearQueueForUser(USER.id);
});

it("ends the session for a reset link and keeps the account's queued writes", async () => {
  signedInWithQueuedWrite();

  await authService.logout({
    keepBiometricCredentials: true,
    keepQueuedWrites: true,
  });

  expect(useStore.getState().user).toBeNull();
  expect(useStore.getState().navigationState).toBe('auth');
  expect(queueStore.getMutationsForUser(USER.id)).toHaveLength(1);
});

it('keeps queued writes through a session end the server started', async () => {
  signedInWithQueuedWrite();

  await useStore.getState().endSession('refresh_rejected');

  expect(useStore.getState().user).toBeNull();
  expect(queueStore.getMutationsForUser(USER.id)).toHaveLength(1);
});

it('drops queued writes for a sign-out that joins a running server end', async () => {
  signedInWithQueuedWrite();

  const serverEnd = useStore.getState().endSession('refresh_rejected');
  await authService.logout();
  await serverEnd;

  expect(useStore.getState().user).toBeNull();
  expect(useStore.getState().navigationState).toBe('auth');
  expect(queueStore.getMutationsForUser(USER.id)).toEqual([]);
});
