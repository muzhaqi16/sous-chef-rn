import type { DocumentNode } from 'graphql';
import { storage, isRecoveryStorage } from '#/storage/mmkv';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import type { QueueStore as QueueStoreType } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus, type QueuedMutation } from '#/apollo/offlineQueue/types';

jest.mock('#/storage/mmkv');

const { __mockStore } = jest.requireMock<{
  __mockStore: Map<string, unknown>;
}>('#/storage/mmkv');

const recoveryMode = isRecoveryStorage as jest.Mock;
const setSpy = storage.set as jest.Mock;

function makeMutation(): QueuedMutation {
  return {
    id: 'mut-1',
    userId: 'user-1',
    operationName: 'CreatePantryItem',
    mutation: { kind: 'Document', definitions: [] } as unknown as DocumentNode,
    variables: { input: { name: 'Milk' }, email: 'someone@example.com' },
    status: QueueStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    requiresAuth: true,
  };
}

/**
 * When the device key cannot be read the session runs on an UNENCRYPTED MMKV
 * file. The session is allowed to continue there; what must not follow it onto
 * disk is the cache of server data and the queue of pending writes, which carry
 * names, emails, household membership and full mutation variables.
 */

/**
 * A FRESH evaluation, so the module binds the mocked storage. `queueStore.ts`
 * exports a module-scope singleton, which jest evaluates while loading the
 * setup graph — before this file's `jest.mock` is registered — so the
 * top-level import holds a build wired to the real module and every spy
 * assertion would read an instance nothing under test touches.
 */
const freshQueueStore = (): QueueStoreType => {
  let Store!: new () => QueueStoreType;
  jest.isolateModules(() => {
    Store = jest.requireActual<{ QueueStore: new () => QueueStoreType }>(
      '#/apollo/offlineQueue/queueStore',
    ).QueueStore;
  });
  return new Store();
};
describe('recovery storage keeps data off disk', () => {
  beforeEach(() => {
    __mockStore.clear();
    jest.clearAllMocks();
    recoveryMode.mockReturnValue(false);
  });

  const cache = {
    'User:1': {
      __typename: 'User',
      id: '1',
      email: 'someone@example.com',
      name: 'A Person',
    },
  };

  describe('the Apollo cache', () => {
    it('is persisted on the encrypted instance', () => {
      apolloCachePersistence.saveImmediate(cache);

      expect(setSpy).toHaveBeenCalled();
      const written = setSpy.mock.calls
        .map(([, value]) => String(value))
        .join('');
      expect(written).toContain('someone@example.com');
    });

    it('is not persisted on the recovery instance', () => {
      recoveryMode.mockReturnValue(true);

      apolloCachePersistence.saveImmediate(cache);
      apolloCachePersistence.save(cache);
      apolloCachePersistence.scheduleExtractAndSave(() => cache);

      expect(setSpy).not.toHaveBeenCalled();
    });

    it('leaves no pending write that fires after the debounce', () => {
      jest.useFakeTimers();
      recoveryMode.mockReturnValue(true);

      apolloCachePersistence.scheduleExtractAndSave(() => cache);
      jest.runAllTimers();

      expect(setSpy).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('the offline queue', () => {
    it('is persisted on the encrypted instance', () => {
      freshQueueStore().addMutation(makeMutation());

      expect(setSpy).toHaveBeenCalled();
      const written = setSpy.mock.calls
        .map(([, value]) => String(value))
        .join('');
      expect(written).toContain('someone@example.com');
    });

    it('is not persisted on the recovery instance', () => {
      recoveryMode.mockReturnValue(true);

      freshQueueStore().addMutation(makeMutation());

      expect(setSpy).not.toHaveBeenCalled();
    });

    it('still queues in memory so the session keeps working', () => {
      recoveryMode.mockReturnValue(true);
      const store = freshQueueStore();

      store.setCurrentUserId('user-1');
      store.addMutation(makeMutation());

      expect(store.getMutationsForUser('user-1')).toHaveLength(1);
      // The pending badge reads through the current user, which is also held
      // in memory only here — so the whole queue path works, just not on disk.
      expect(store.getPendingCount()).toBe(1);
    });

    it('does not write the current user id on the recovery instance', () => {
      recoveryMode.mockReturnValue(true);
      const store = freshQueueStore();

      store.setCurrentUserId('user-1');

      expect(setSpy).not.toHaveBeenCalled();
      expect(store.getCurrentUserId()).toBe('user-1');
    });

    it('writes the current user id on the encrypted instance', () => {
      const store = freshQueueStore();

      store.setCurrentUserId('user-1');

      expect(setSpy).toHaveBeenCalled();
      expect(store.getCurrentUserId()).toBe('user-1');
    });
  });
});
