import { useSyncExternalStore } from 'react';
import { queueStore } from '#/apollo/offlineQueue/queueStore';

/**
 * Whether a row has a change still waiting to reach the server.
 *
 * DERIVED from the queue rather than stored beside it. A separate record of
 * "what is pending" is exactly what this work exists to remove: one each call
 * site had to remember to update would drift from the queue the same way the
 * optimistic-field store drifted from the cache.
 *
 * Reads the same memoized `getPendingClientIds()` set that `cache.ts` already
 * consults on every connection merge, so a row asking about itself costs a Set
 * lookup rather than a queue scan.
 *
 * The snapshot is a BOOLEAN, deliberately. Returning an object would allocate a
 * new one on every queue change and re-render every row that asks, rather than
 * only the row whose own state flipped — which is what makes this safe to call
 * from a list cell.
 */
const subscribe = (onStoreChange: () => void) =>
  queueStore.subscribe(onStoreChange);

export const useIsWritePending = (id: string | undefined): boolean =>
  useSyncExternalStore(subscribe, () =>
    id ? queueStore.getPendingClientIds().has(id) : false,
  );
