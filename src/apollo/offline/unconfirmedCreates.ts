import { queueStore } from '#/apollo/offlineQueue/queueStore';

/**
 * Client-minted ids whose create the server has not acknowledged. A local-first
 * create publishes the row's cuid to the cache BEFORE firing, so a detail query
 * keyed on that id can only fail (`RESOURCE_NOT_FOUND`) and then sits in an
 * error state that never retries. Detail queries gate `skip` on this set.
 */

// The in-flight window. The queued window belongs to
// `queueStore.getPendingClientIds`, and the hand-off has no gap: `queueLink`
// enqueues before completing the observable, so `confirm()` on a queued create
// runs with the id already in the pending set.
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

/** Attached on first use and kept — notifying zero listeners is a no-op. */
let watchingQueue = false;

const notify = (): void => {
  listeners.forEach(listener => listener());
};

export const unconfirmedCreates = {
  /** Mark a client-minted id as not yet acknowledged by the server. */
  mark(id: string): void {
    if (inFlight.has(id)) return;
    inFlight.add(id);
    notify();
  },

  /**
   * Release the in-flight claim on `id`. Call once the create mutation
   * resolves, whatever the outcome: acknowledged and rejected both mean no
   * detail read can hit a missing row, and queued means `queueStore` has
   * already taken over.
   */
  confirm(id: string): void {
    if (!inFlight.delete(id)) return;
    notify();
  },

  /** Whether a create for `id` is still in flight or waiting to replay. */
  has(id: string): boolean {
    return inFlight.has(id) || queueStore.getPendingClientIds().has(id);
  },

  /**
   * Subscribe to changes in either window. `useSyncExternalStore`-compatible.
   * A queue replay draining the last pending create is what unskips a detail
   * query for an offline-created row, so queue changes are relayed too.
   */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (!watchingQueue) {
      watchingQueue = true;
      queueStore.subscribe(notify);
    }

    return () => {
      listeners.delete(listener);
    };
  },
};
