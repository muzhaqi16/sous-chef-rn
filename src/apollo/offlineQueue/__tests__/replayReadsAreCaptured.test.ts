/**
 * A builder that reads the cache at replay must also capture those reads when
 * the write is queued, or a row that leaves the cache makes the write unsendable
 * until it ages out.
 */
import {
  makeQueuedMutation,
  makeSyncCacheStub,
} from '#/test-utils/queuedMutation';
import { SYNC_REGISTRY } from '#/apollo/offlineQueue/syncRegistry';

describe('replay reads are captured when queued', () => {
  it.each(Object.entries(SYNC_REGISTRY))(
    '%s captures every cache value its replay reads',
    (operationName, build) => {
      const cache = makeSyncCacheStub();
      cache.readFragment.mockReturnValue(null);
      const mutation = makeQueuedMutation({
        operationName,
        variables: {
          input: { id: 'row-1', itemId: 'row-1', pantryItemId: 'row-1' },
        },
      });

      try {
        build(mutation, cache);
      } catch {
        // A missing value is the case under test, not a failure of it.
      }

      const readsTheCache = cache.readFragment.mock.calls.length > 0;
      expect(readsTheCache && !build.captureReplayInputs).toBe(false);
    },
  );
});
