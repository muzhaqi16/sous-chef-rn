import { useSyncExternalStore } from 'react';
import { queueStore } from '#/apollo/offlineQueue/queueStore';

const subscribe = (onStoreChange: () => void) =>
  queueStore.subscribe(onStoreChange);

const getSnapshot = () => queueStore.getPendingCount();

/**
 * Live count of the current user's PENDING offline-queue mutations — the
 * "changes waiting to sync" number shown in the offline banner. Updates on
 * every queue change (enqueue, replay, failure cleanup, user switch).
 */
export const usePendingMutationCount = (): number =>
  useSyncExternalStore(subscribe, getSnapshot);
