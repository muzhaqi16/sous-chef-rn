import { storage } from '#/store/deviceStorage';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { QueueStore } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus, type QueuedMutation } from '#/apollo/offlineQueue/types';
import { queuedMutationFor } from '#/test-utils/queuedMutation';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';

const recoveryMode = jest.spyOn(storage, 'isRecovery');
const setSpy = jest.spyOn(storage, 'set');

function makeMutation(): QueuedMutation {
  return {
    id: 'mut-1',
    userId: 'user-1',
    ...queuedMutationFor(CreatePantryItemDocument),
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
 * When the device key cannot be read the session runs on an UNENCRYPTED store
 * (`storage.isRecovery()`). The session is allowed to continue there; what must
 * not follow it onto disk is the cache of server data and the queue of pending
 * writes, which carry names, emails, household membership and full mutation
 * variables.
 */
describe('recovery storage keeps data off disk', () => {
  beforeEach(() => {
    storage.clearAll();
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
      apolloCachePersistence.scheduleExtractAndSave(() => cache);
      apolloCachePersistence.flushPending();

      expect(setSpy).toHaveBeenCalled();
      const written = setSpy.mock.calls
        .map(([, value]) => String(value))
        .join('');
      expect(written).toContain('someone@example.com');
    });

    it('is not persisted on the recovery instance', () => {
      recoveryMode.mockReturnValue(true);

      apolloCachePersistence.scheduleExtractAndSave(() => cache);
      apolloCachePersistence.flushPending();

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
      new QueueStore().addMutation(makeMutation());

      expect(setSpy).toHaveBeenCalled();
      const written = setSpy.mock.calls
        .map(([, value]) => String(value))
        .join('');
      expect(written).toContain('someone@example.com');
    });

    it('is not persisted on the recovery instance', () => {
      recoveryMode.mockReturnValue(true);

      new QueueStore().addMutation(makeMutation());

      expect(setSpy).not.toHaveBeenCalled();
    });

    it('still queues in memory so the session keeps working', () => {
      recoveryMode.mockReturnValue(true);
      const store = new QueueStore();

      store.setCurrentUserId('user-1');
      store.addMutation(makeMutation());

      expect(store.getMutationsForUser('user-1')).toHaveLength(1);
      // The pending badge reads through the current user, which is also held
      // in memory only here — so the whole queue path works, just not on disk.
      expect(store.getPendingCount()).toBe(1);
    });

    it('does not write the current user id on the recovery instance', () => {
      recoveryMode.mockReturnValue(true);
      const store = new QueueStore();

      store.setCurrentUserId('user-1');

      expect(setSpy).not.toHaveBeenCalled();
      expect(store.getCurrentUserId()).toBe('user-1');
    });

    it('writes the current user id on the encrypted instance', () => {
      const store = new QueueStore();

      store.setCurrentUserId('user-1');

      expect(setSpy).toHaveBeenCalled();
      expect(store.getCurrentUserId()).toBe('user-1');
    });
  });
});
