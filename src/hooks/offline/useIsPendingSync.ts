import { useSyncExternalStore } from 'react';
import { queueStore } from '#/apollo/offlineQueue/queueStore';

const subscribe = (onStoreChange: () => void) =>
  queueStore.subscribe(onStoreChange);

/**
 * Whether `id` belongs to a write still queued. Safe from a list cell: the
 * snapshot is a boolean, so a row re-renders only when its OWN state flips, and
 * the memoized `getPendingClientIds()` set makes it a lookup, not a queue scan.
 */
export const useIsPendingSync = (id: string | undefined): boolean =>
  useSyncExternalStore(subscribe, () =>
    id ? queueStore.getPendingClientIds().has(id) : false,
  );
