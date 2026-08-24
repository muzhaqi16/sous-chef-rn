import { useSyncExternalStore } from 'react';
import { queueStore } from '#/apollo/offlineQueue/queueStore';

const subscribe = (onStoreChange: () => void) =>
  queueStore.subscribe(onStoreChange);

/**
 * Whether `id` belongs to a write still waiting in the offline queue.
 *
 * Reads the same memoized `getPendingClientIds()` set that `cache.ts` already
 * consults on every `itemsConnection` merge, so a row asking about itself costs
 * a Set lookup, not a queue scan.
 *
 * The snapshot is a boolean, so a row re-renders only when its OWN pending
 * state flips — not whenever any queue entry changes. That is what makes this
 * safe to call from a list cell.
 */
export const useIsPendingSync = (id: string | undefined): boolean =>
  useSyncExternalStore(subscribe, () =>
    id ? queueStore.getPendingClientIds().has(id) : false,
  );
